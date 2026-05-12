import mimetypes
import os
import boto3


class R2Client:
    def __init__(self):
        self.endpoint = os.getenv("R2_ENDPOINT")
        self.bucket_name = os.getenv("R2_BUCKET_NAME")
        self.access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
        missing = [k for k, v in {
            "R2_ENDPOINT": self.endpoint,
            "R2_BUCKET_NAME": self.bucket_name,
            "R2_ACCESS_KEY_ID": self.access_key,
            "R2_SECRET_ACCESS_KEY": self.secret_key,
        }.items() if not v]
        if missing:
            raise ValueError(f"Missing required R2 environment variables: {', '.join(missing)}")
        if self.bucket_name in self.endpoint:
            raise ValueError("R2_ENDPOINT must not include bucket name; set bucket in R2_BUCKET_NAME")

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="auto",
        )

    def upload_file(self, local_path: str, output_key: str) -> None:
        content_type, _ = mimetypes.guess_type(local_path)
        self.client.upload_file(
            local_path,
            self.bucket_name,
            output_key,
            ExtraArgs={"ContentType": content_type or "application/octet-stream"},
        )
