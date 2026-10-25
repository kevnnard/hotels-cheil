import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import seed_hotels

EMAIL = "admin@example.test"
PASSWORD = "Sup3rSecretValue"
TOKEN = "token-value-123"

HOTELS = [
    {"name": "Alpha", "description": "First", "street": "1 Main St", "city": "Lima", "region": "Lima", "country": "Peru", "postalCode": "15001", "phone": "+51 1 555 0100", "email": "alpha@example.test", "website": "https://alpha.example.com", "image": "alpha.jpg"},
    {"name": "Beta", "description": "Second", "street": "2 Main St", "city": "Cusco", "region": "Cusco", "country": "Peru", "postalCode": "08001", "phone": "+51 84 555 0101", "email": "beta@example.test", "website": "https://beta.example.com", "image": "beta.jpg"},
]


class FakeApi:
    def __init__(self, existing=(), unhealthy_checks=0, always_down=False, login_status=200, with_image=(), upload_status=200):
        self.calls = []
        self.created = []
        self.uploads = []
        self.existing = list(existing)
        self.with_image = set(with_image)
        self.upload_status = upload_status
        self.unhealthy_checks = unhealthy_checks
        self.always_down = always_down
        self.login_status = login_status

    def __call__(self, method, path, body=None, token=None, upload=None):
        self.calls.append((method, path, token))
        if self.always_down:
            raise ConnectionRefusedError("down")
        parsed = urlparse(path)
        if parsed.path == "/health":
            if self.unhealthy_checks > 0:
                self.unhealthy_checks -= 1
                raise ConnectionRefusedError("starting")
            return 200, None
        if parsed.path == "/api/auth/login":
            if self.login_status != 200:
                return self.login_status, None
            return 200, {"accessToken": TOKEN}
        if parsed.path == "/api/hotels" and method == "GET":
            name = parse_qs(parsed.query)["name"][0]
            items = [self.item(n) for n in self.existing if name.lower() in n.lower()]
            return 200, {"items": items, "page": 1, "pageSize": 100, "totalItems": len(items), "totalPages": 1}
        if parsed.path == "/api/hotels" and method == "POST":
            self.created.append(body["name"])
            self.existing.append(body["name"])
            return 201, self.item(body["name"])
        if parsed.path.endswith("/image") and method == "PUT":
            field, filename, content_type, content = upload
            self.uploads.append((parsed.path, field, filename, content_type, content))
            if self.upload_status != 200:
                return self.upload_status, None
            self.with_image.add(parsed.path.split("/")[3].removeprefix("id-"))
            return 200, {"contentType": "image/jpeg"}
        return 404, None

    def item(self, name):
        image = {"contentType": "image/jpeg"} if name in self.with_image else None
        return {"id": "id-" + name, "name": name, "image": image}


def run_main(api, env=None):
    with tempfile.TemporaryDirectory() as images_dir:
        for name in ("alpha.jpg", "beta.jpg"):
            Path(images_dir, name).write_bytes(b"jpeg-" + name.encode())
        environment = {"ADMINISTRATOR_EMAIL": EMAIL, "ADMINISTRATOR_PASSWORD": PASSWORD, "SEED_IMAGES_DIR": images_dir}
        if env is not None:
            environment = env
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = seed_hotels.main(environment, api, sleep=lambda _: None, hotels=HOTELS, attempts=3)
        return code, out.getvalue() + err.getvalue()


class SeedHotelsTests(unittest.TestCase):
    def test_creates_only_the_missing_hotels(self):
        api = FakeApi(existing=["Alpha"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual(["Beta"], api.created)

    def test_does_not_duplicate_when_run_twice(self):
        api = FakeApi()

        run_main(api)
        run_main(api)

        self.assertEqual(["Alpha", "Beta"], api.created)

    def test_a_partial_name_match_does_not_count_as_existing(self):
        api = FakeApi(existing=["Alpha Grand"])

        run_main(api)

        self.assertEqual(["Alpha", "Beta"], api.created)

    def test_never_prints_credentials(self):
        for api in (FakeApi(), FakeApi(login_status=401), FakeApi(always_down=True)):
            _, output = run_main(api)
            self.assertNotIn(PASSWORD, output)
            self.assertNotIn(EMAIL, output)
            self.assertNotIn(TOKEN, output)

    def test_waits_for_health_before_login(self):
        api = FakeApi(unhealthy_checks=2)

        code, _ = run_main(api)

        self.assertEqual(0, code)
        paths = [urlparse(path).path for _, path, _ in api.calls]
        self.assertEqual(["/health"] * 3, paths[:3])
        self.assertEqual("/api/auth/login", paths[3])

    def test_fails_when_the_api_stays_unavailable(self):
        api = FakeApi(always_down=True)

        code, _ = run_main(api)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.created)
        self.assertEqual(3, len(api.calls))

    def test_fails_when_login_is_rejected(self):
        api = FakeApi(login_status=401)

        code, _ = run_main(api)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.created)

    def test_fails_when_credentials_are_missing(self):
        api = FakeApi()

        code, _ = run_main(api, env={})

        self.assertNotEqual(0, code)
        self.assertEqual([], api.calls)

    def test_authenticates_hotel_requests_with_the_token(self):
        api = FakeApi()

        run_main(api)

        hotel_calls = [call for call in api.calls if urlparse(call[1]).path == "/api/hotels"]
        self.assertTrue(hotel_calls)
        self.assertTrue(all(token == TOKEN for _, _, token in hotel_calls))


class SeedImageTests(unittest.TestCase):
    def test_uploads_an_image_for_a_hotel_without_one(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Beta"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual([("/api/hotels/id-Alpha/image", "image", "alpha.jpg", "image/jpeg", b"jpeg-alpha.jpg")], api.uploads)

    def test_uploads_an_image_for_each_newly_created_hotel(self):
        api = FakeApi()

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual(["/api/hotels/id-Alpha/image", "/api/hotels/id-Beta/image"], [upload[0] for upload in api.uploads])

    def test_does_not_upload_again_when_the_hotel_already_has_an_image(self):
        api = FakeApi(existing=["Alpha", "Beta"], with_image=["Alpha", "Beta"])

        code, _ = run_main(api)

        self.assertEqual(0, code)
        self.assertEqual([], api.uploads)

    def test_does_not_upload_twice_when_run_twice(self):
        api = FakeApi()

        run_main(api)
        run_main(api)

        self.assertEqual(2, len(api.uploads))

    def test_authenticates_the_upload_with_the_token(self):
        api = FakeApi()

        run_main(api)

        upload_calls = [call for call in api.calls if call[0] == "PUT"]
        self.assertEqual(2, len(upload_calls))
        self.assertTrue(all(token == TOKEN for _, _, token in upload_calls))

    def test_fails_without_leaking_credentials_when_the_upload_is_rejected(self):
        api = FakeApi(upload_status=422)

        code, output = run_main(api)

        self.assertNotEqual(0, code)
        self.assertIn("422", output)
        for secret in (PASSWORD, EMAIL, TOKEN):
            self.assertNotIn(secret, output)

    def test_fails_when_the_image_file_is_missing(self):
        api = FakeApi()
        env = {"ADMINISTRATOR_EMAIL": EMAIL, "ADMINISTRATOR_PASSWORD": PASSWORD, "SEED_IMAGES_DIR": "/nonexistent-seed-images"}

        code, output = run_main(api, env=env)

        self.assertNotEqual(0, code)
        self.assertEqual([], api.uploads)
        self.assertNotIn(PASSWORD, output)


class SeedDataTests(unittest.TestCase):
    def test_the_data_file_holds_thirty_valid_hotels_and_four_images(self):
        path = Path(seed_hotels.__file__).with_name("hotels.json")
        images = Path(seed_hotels.__file__).with_name("images")

        hotels = json.loads(path.read_text(encoding="utf-8"))

        self.assertEqual(30, len(hotels))
        self.assertEqual(30, len({hotel["name"] for hotel in hotels}))
        self.assertGreaterEqual(len({hotel["country"] for hotel in hotels}), 15)
        self.assertGreaterEqual(len({hotel["city"] for hotel in hotels}), 25)
        required = {"name", "description", "street", "city", "region", "country", "postalCode", "phone", "email", "website"}
        limits = {"name": 200, "description": 2000, "street": 200, "city": 100, "region": 100, "country": 100, "postalCode": 20, "phone": 30, "email": 254, "website": 2048}
        for hotel in hotels:
            self.assertEqual(required, set(hotel) - {"image"})
            self.assertTrue(hotel["name"].startswith("Aurea "))
            self.assertTrue(hotel["email"].endswith("@example.test"))
            website = urlparse(hotel["website"])
            self.assertEqual("https", website.scheme, hotel["name"])
            self.assertTrue(website.hostname == "example.com" or website.hostname.endswith(".example.com"), hotel["name"])
            for key, limit in limits.items():
                self.assertTrue(0 < len(hotel[key]) <= limit, key)
        with_image = [hotel for hotel in hotels if "image" in hotel]
        self.assertEqual(
            ["Aurea Palace Lima", "Aurea Sacred Valley Lodge", "Aurea Harbour House", "Aurea Lake Retreat"],
            [hotel["name"] for hotel in hotels[:4]],
        )
        self.assertEqual([hotel["name"] for hotel in hotels[:4]], [hotel["name"] for hotel in with_image])
        for hotel in with_image:
            self.assertTrue(images.joinpath(hotel["image"]).is_file())


if __name__ == "__main__":
    unittest.main()
