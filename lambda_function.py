import json
import boto3
import base64
import uuid
import urllib.parse


# Create an S3 client
s3 = boto3.client("s3")


# Create an Amazon Rekognition client
rekognition = boto3.client("rekognition")


# Name of the S3 bucket
BUCKET_NAME = "face-detection-mini-project"


def lambda_handler(event, context):

    # ---------------------------------------------------------
    # PART 1: REQUEST FROM API GATEWAY
    # ---------------------------------------------------------
    # If the Lambda is called through API Gateway,
    # the event contains "httpMethod" or "requestContext".
    if "httpMethod" in event or "requestContext" in event:

        try:

            # Get the image data from the API Gateway request
            body = event.get("body", "")

            # API Gateway sends the binary image as Base64 text.
            # Decode it back into actual image bytes.
            image_bytes = base64.b64decode(body)

            # Generate a unique filename for the uploaded image
            file_name = f"web-upload-{uuid.uuid4()}.jpg"

            # Upload the image to S3
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=file_name,
                Body=image_bytes,
                ContentType="image/jpeg"
            )

            # Display upload information in CloudWatch
            print(f"Image uploaded from website: {file_name}")

            # -------------------------------------------------
            # DETECT FACES USING AMAZON REKOGNITION
            # -------------------------------------------------

            # Send the uploaded S3 image to Rekognition
            response = rekognition.detect_faces(
                Image={
                    "S3Object": {
                        "Bucket": BUCKET_NAME,
                        "Name": file_name
                    }
                },
                Attributes=["DEFAULT"]
            )

            # Count the number of detected faces
            face_count = len(response["FaceDetails"])

            # Display the result in CloudWatch
            print(f"FACE DETECTION RESULT: {face_count} faces detected")

            # -------------------------------------------------
            # RETURN RESULT TO API GATEWAY
            # -------------------------------------------------

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

            # Display the error in CloudWatch
            print(f"API Error: {str(e)}")

            # Return an error response
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


    # ---------------------------------------------------------
    # PART 2: REQUEST FROM S3
    # ---------------------------------------------------------
    # If the Lambda was not called by API Gateway,
    # handle the original S3 ObjectCreated event.


    # Get the S3 bucket name from the event
    bucket_name = event["Records"][0]["s3"]["bucket"]["name"]


    # Get the uploaded image name from the S3 event
    object_key = event["Records"][0]["s3"]["object"]["key"]


    # Decode URL-encoded characters from the filename
    object_key = urllib.parse.unquote_plus(object_key)


    # Display S3 information in CloudWatch
    print(f"Bucket: {bucket_name}")
    print(f"Image: {object_key}")


    # ---------------------------------------------------------
    # DETECT FACES FOR S3-UPLOADED IMAGE
    # ---------------------------------------------------------

    # Send the S3 image to Amazon Rekognition
    response = rekognition.detect_faces(
        Image={
            "S3Object": {
                "Bucket": bucket_name,
                "Name": object_key
            }
        },
        Attributes=["DEFAULT"]
    )


    # Count the detected faces
    face_count = len(response["FaceDetails"])


    # Display the result in CloudWatch
    print(f"FACE DETECTION RESULT: {face_count} faces detected")


    # Return the result
    return {
        "statusCode": 200,

        "body": json.dumps({
            "image": object_key,
            "face_count": face_count
        })
    }