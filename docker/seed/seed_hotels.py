import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

HEALTH_ATTEMPTS = 60
HEALTH_DELAY_SECONDS = 2
REQUEST_TIMEOUT_SECONDS = 15
PAGE_SIZE = 100
HOTELS_FILE = Path(__file__).with_name("hotels.json")
DEFAULT_IMAGES_DIR = "/seed/images"
IMAGE_FIELD = "image"
IMAGE_CONTENT_TYPE = "image/jpeg"
PRICE_FIELD = "pricePerNight"
SEED_ONLY_FIELDS = {"image", "images", "ratings", "isActive"}
GUEST_COUNT = 6
GUEST_EMAIL_TEMPLATE = "seed-guest-{}@aurea.example"


def http_transport(base_url):
    def send(method, path, body=None, token=None, upload=None):
        content_type = "application/json"
        data = None if body is None else json.dumps(body).encode("utf-8")
        if upload is not None:
            boundary = uuid.uuid4().hex
            data = multipart_body(boundary, *upload)
            content_type = "multipart/form-data; boundary=" + boundary
        request = urllib.request.Request(base_url + path, data=data, method=method)
        if data is not None:
            request.add_header("Content-Type", content_type)
        if token is not None:
            request.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return response.status, parse_json(response.read())
        except urllib.error.HTTPError as error:
            return error.code, None

    return send


def multipart_body(boundary, field, filename, content_type, content):
    head = (
        "--{}\r\nContent-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\nContent-Type: {}\r\n\r\n"
    ).format(boundary, field, filename, content_type)
    return head.encode("utf-8") + content + "\r\n--{}--\r\n".format(boundary).encode("utf-8")


def parse_json(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def wait_for_health(send, sleep, attempts, delay):
    for attempt in range(attempts):
        try:
            status, _ = send("GET", "/health")
            if status == 200:
                return True
        except OSError:
            pass
        if attempt < attempts - 1:
            sleep(delay)
    return False


def request_token(send, email, password):
    status, payload = send("POST", "/api/auth/login", {"email": email, "password": password})
    if status != 200 or not payload:
        return status, None
    return status, payload.get("accessToken")


def sign_in(send, email, password):
    return request_token(send, email, password)[1]


def guest_emails():
    return [GUEST_EMAIL_TEMPLATE.format(number) for number in range(1, GUEST_COUNT + 1)]


def ensure_guest(send, email, password):
    status, _ = send("POST", "/api/auth/register", {"email": email, "password": password})
    if status not in (201, 409):
        raise RuntimeError("Registering {} failed with status {}".format(email, status))
    status, token = request_token(send, email, password)
    if token is None:
        raise RuntimeError("Signing in {} failed with status {}".format(email, status))
    return token


def find_hotel(send, token, name):
    page = 1
    while True:
        path = "/api/hotels?name={}&page={}&pageSize={}".format(quote(name, safe=""), page, PAGE_SIZE)
        status, payload = send("GET", path, token=token)
        if status != 200 or payload is None:
            raise RuntimeError("Listing hotels failed with status {}".format(status))
        for item in payload.get("items", []):
            if item.get("name") == name:
                return item
        if page >= payload.get("totalPages", 1):
            return None
        page += 1


def hotel_details(hotel):
    return {key: value for key, value in hotel.items() if key not in SEED_ONLY_FIELDS}


def ensure_hotel(send, token, hotel):
    existing = find_hotel(send, token, hotel["name"])
    if existing is not None:
        print("exists  {}".format(hotel["name"]))
        return ensure_pricing(send, token, hotel, existing)
    status, created = send("POST", "/api/hotels", hotel_details(hotel), token=token)
    if status != 201 or not created:
        raise RuntimeError("Creating {} failed with status {}".format(hotel["name"], status))
    print("created {}".format(hotel["name"]))
    return created


def ensure_pricing(send, token, hotel, stored):
    if stored.get("pricing") is not None or hotel.get(PRICE_FIELD) is None:
        return stored
    status, updated = send("PUT", "/api/hotels/{}".format(stored["id"]), hotel_details(hotel), token=token)
    if status != 200 or not updated:
        raise RuntimeError("Pricing {} failed with status {}".format(hotel["name"], status))
    print("priced {}".format(hotel["name"]))
    return updated


def image_files(hotel):
    primary = hotel.get("image")
    if primary is None:
        return []
    return [primary] + list(hotel.get("images", []))


def stored_positions(stored):
    positions = {slot.get("position") for slot in stored.get("images") or []}
    if stored.get("image") is not None:
        positions.add(0)
    return positions


def image_path(position):
    return "image" if position == 0 else "images/{}".format(position)


def ensure_images(send, token, hotel, stored, images_dir):
    present = stored_positions(stored)
    for position, file_name in enumerate(image_files(hotel)):
        if position in present:
            print("image present {} {}".format(hotel["name"], position))
            continue
        content = (Path(images_dir) / file_name).read_bytes()
        upload = (IMAGE_FIELD, file_name, IMAGE_CONTENT_TYPE, content)
        path = "/api/hotels/{}/{}".format(stored["id"], image_path(position))
        status, _ = send("PUT", path, token=token, upload=upload)
        if status != 200:
            raise RuntimeError("Uploading image {} for {} failed with status {}".format(file_name, hotel["name"], status))
        print("image uploaded {} {}".format(hotel["name"], position))


def missing_images(hotels, images_dir):
    return [name for hotel in hotels for name in image_files(hotel) if not (Path(images_dir) / name).is_file()]


def ensure_ratings(send, hotel, stored, guest_tokens):
    sent = unchanged = 0
    for token, score in zip(guest_tokens, hotel.get("ratings", [])):
        path = "/api/hotels/{}/ratings".format(stored["id"])
        status, own = send("GET", path + "/me", token=token)
        if status != 200 or own is None:
            raise RuntimeError("Reading a rating of {} failed with status {}".format(hotel["name"], status))
        if own.get("score") is not None and float(own["score"]) == float(score):
            unchanged += 1
            continue
        status, _ = send("POST", path, {"score": score}, token=token)
        if status != 200:
            raise RuntimeError("Rating {} failed with status {}".format(hotel["name"], status))
        sent += 1
    if sent:
        print("rated {} ({} new)".format(hotel["name"], sent))
    return sent, unchanged


def seed_ratings(send, password, seeded):
    guest_tokens = [ensure_guest(send, email, password) for email in guest_emails()]
    sent = unchanged = 0
    for hotel, stored in seeded:
        hotel_sent, hotel_unchanged = ensure_ratings(send, hotel, stored, guest_tokens)
        sent += hotel_sent
        unchanged += hotel_unchanged
    return len(guest_tokens), sent, unchanged


def ensure_status(send, token, hotel, stored):
    if "isActive" not in hotel or stored.get("isActive") == hotel["isActive"]:
        return 0
    body = {"isActive": hotel["isActive"]}
    status, _ = send("PUT", "/api/hotels/{}/status".format(stored["id"]), body, token=token)
    if status != 200:
        raise RuntimeError("Changing the state of {} failed with status {}".format(hotel["name"], status))
    print("{} {}".format("activated" if hotel["isActive"] else "deactivated", hotel["name"]))
    return 1


def load_hotels():
    return json.loads(HOTELS_FILE.read_text(encoding="utf-8"))


def main(environment, send, sleep=time.sleep, hotels=None, attempts=HEALTH_ATTEMPTS, delay=HEALTH_DELAY_SECONDS):
    email = environment.get("ADMINISTRATOR_EMAIL")
    password = environment.get("ADMINISTRATOR_PASSWORD")
    if not email or not password:
        print("ADMINISTRATOR_EMAIL and ADMINISTRATOR_PASSWORD are required", file=sys.stderr)
        return 2
    hotels = hotels if hotels is not None else load_hotels()
    images_dir = environment.get("SEED_IMAGES_DIR") or DEFAULT_IMAGES_DIR
    missing = missing_images(hotels, images_dir)
    if missing:
        print("Seeding failed: image files not found in {}: {}".format(images_dir, ", ".join(missing)), file=sys.stderr)
        return 1
    if not wait_for_health(send, sleep, attempts, delay):
        print("The API did not become healthy after {} attempts".format(attempts), file=sys.stderr)
        return 1
    token = sign_in(send, email, password)
    if token is None:
        print("The administrator sign-in was rejected", file=sys.stderr)
        return 1
    guest_password = environment.get("SEED_GUEST_PASSWORD")
    try:
        seeded = []
        for hotel in hotels:
            stored = ensure_hotel(send, token, hotel)
            ensure_images(send, token, hotel, stored, images_dir)
            seeded.append((hotel, stored))
        guests = sent = unchanged = 0
        if guest_password:
            guests, sent, unchanged = seed_ratings(send, guest_password, seeded)
        else:
            print("SEED_GUEST_PASSWORD is not set; skipping guest accounts and ratings")
        changed = sum(ensure_status(send, token, hotel, stored) for hotel, stored in seeded)
    except (RuntimeError, OSError) as error:
        print("Seeding failed: {}".format(error), file=sys.stderr)
        return 1
    print("Seed finished: {} hotels, {} guests, {} ratings sent, {} ratings unchanged, {} state changes".format(len(seeded), guests, sent, unchanged, changed))
    return 0


if __name__ == "__main__":
    api_url = os.environ.get("API_BASE_URL", "http://api:8080").rstrip("/")
    sys.exit(main(os.environ, http_transport(api_url)))
