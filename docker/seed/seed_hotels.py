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


def sign_in(send, email, password):
    status, payload = send("POST", "/api/auth/login", {"email": email, "password": password})
    if status != 200 or not payload:
        return None
    return payload.get("accessToken")


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


def ensure_hotel(send, token, hotel):
    existing = find_hotel(send, token, hotel["name"])
    if existing is not None:
        print("exists  {}".format(hotel["name"]))
        return existing
    payload = {key: value for key, value in hotel.items() if key != "image"}
    status, created = send("POST", "/api/hotels", payload, token=token)
    if status != 201 or not created:
        raise RuntimeError("Creating {} failed with status {}".format(hotel["name"], status))
    print("created {}".format(hotel["name"]))
    return created


def ensure_image(send, token, hotel, stored, images_dir):
    file_name = hotel.get("image")
    if file_name is None:
        return
    if stored.get("image") is not None:
        print("image present {}".format(hotel["name"]))
        return
    content = (Path(images_dir) / file_name).read_bytes()
    upload = (IMAGE_FIELD, file_name, IMAGE_CONTENT_TYPE, content)
    status, _ = send("PUT", "/api/hotels/{}/image".format(stored["id"]), token=token, upload=upload)
    if status != 200:
        raise RuntimeError("Uploading the image for {} failed with status {}".format(hotel["name"], status))
    print("image uploaded {}".format(hotel["name"]))


def load_hotels():
    return json.loads(HOTELS_FILE.read_text(encoding="utf-8"))


def main(environment, send, sleep=time.sleep, hotels=None, attempts=HEALTH_ATTEMPTS, delay=HEALTH_DELAY_SECONDS):
    email = environment.get("ADMINISTRATOR_EMAIL")
    password = environment.get("ADMINISTRATOR_PASSWORD")
    if not email or not password:
        print("ADMINISTRATOR_EMAIL and ADMINISTRATOR_PASSWORD are required", file=sys.stderr)
        return 2
    if not wait_for_health(send, sleep, attempts, delay):
        print("The API did not become healthy after {} attempts".format(attempts), file=sys.stderr)
        return 1
    token = sign_in(send, email, password)
    if token is None:
        print("The administrator sign-in was rejected", file=sys.stderr)
        return 1
    images_dir = environment.get("SEED_IMAGES_DIR") or DEFAULT_IMAGES_DIR
    try:
        for hotel in hotels if hotels is not None else load_hotels():
            stored = ensure_hotel(send, token, hotel)
            ensure_image(send, token, hotel, stored, images_dir)
    except (RuntimeError, OSError) as error:
        print("Seeding failed: {}".format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    api_url = os.environ.get("API_BASE_URL", "http://api:8080").rstrip("/")
    sys.exit(main(os.environ, http_transport(api_url)))
