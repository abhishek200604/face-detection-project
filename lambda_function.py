import json
import boto3
import base64
import uuid
import urllib.parse

s3 = boto3.client("s3")
rekognition = boto3.client("rekognition")

BUCKET_NAME = "face-detection-mini-project"


def lambda_handler(event, context):

    # Check if request came from API Gateway
    if "httpMethod" in event or "requestContext" in event:

        try:
            # Get image from API Gateway
            body = event.get("body", "")

            image_bytes = base64.b64decode(body)

            # Generate unique image name
            file_name = f"web-upload-{uuid.uuid4()}.jpg"

            # Upload image to S3
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=file_name,
                Body=image_bytes,
                ContentType="image/jpeg"
            )

            print(f"Image uploaded from website: {file_name}")

            # Detect faces using Rekognition
            response = rekognition.detect_faces(
                Image={
                    "S3Object": {
                        "Bucket": BUCKET_NAME,
                        "Name": file_name
                    }
                },
                Attributes=["DEFAULT"]
            )

            face_count = len(response["FaceDetails"])

            print(f"Number of faces detected: {face_count}")

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({
                    "image": file_name,
                    "face_count": face_count
                })
            }

        except Exception as e:

            print(f"API Error: {str(e)}")

            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({
                    "error": str(e)
                })
            }

    # Existing S3 trigger system
    bucket_name = event["Records"][0]["s3"]["bucket"]["name"]
    object_key = event["Records"][0]["s3"]["object"]["key"]

    object_key = urllib.parse.unquote_plus(object_key)

    print(f"Bucket: {bucket_name}")
    print(f"Image: {object_key}")

    response = rekognition.detect_faces(
        Image={
            "S3Object": {
                "Bucket": bucket_name,
                "Name": object_key
            }
        },
        Attributes=["DEFAULT"]
    )

    face_count = len(response["FaceDetails"])

    print(f"Number of faces detected: {face_count}")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "image": object_key,
            "face_count": face_count
        })
    }
