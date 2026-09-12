import json
import boto3
import base64
import uuid


# --------------------------------------------------
# AWS clients
# --------------------------------------------------

s3 = boto3.client(
    "s3",
    region_name="ap-south-1",
    endpoint_url="https://s3.ap-south-1.amazonaws.com"
)

rekognition = boto3.client("rekognition")

polly = boto3.client("polly")

sns = boto3.client("sns")


# --------------------------------------------------
# S3 bucket
# --------------------------------------------------

BUCKET_NAME = "face-count-detection-project"


# --------------------------------------------------
# SNS topic
# --------------------------------------------------

SNS_TOPIC_ARN = (
    "arn:aws:sns:ap-south-1:358625410414:"
    "FaceDetectionNotifications"
)


# --------------------------------------------------
# Lambda handler
# --------------------------------------------------

def lambda_handler(event, context):

    try:

        # ------------------------------------------
        # Get request body
        # ------------------------------------------

        body = event.get("body", "")

        if not body:
            raise Exception(
                "Request body is empty."
            )


        # ------------------------------------------
        # Decode API Gateway body if required
        # ------------------------------------------

        if event.get("isBase64Encoded"):

            body = base64.b64decode(
                body
            ).decode("utf-8")


        # ------------------------------------------
        # Parse JSON request
        # ------------------------------------------

        request_data = json.loads(body)


        # ------------------------------------------
        # Get Base64 image
        # ------------------------------------------

        base64_image = request_data.get(
            "image",
            ""
        )


        if not base64_image:

            raise Exception(
                "Image data is required."
            )


        # ------------------------------------------
        # Convert Base64 image to bytes
        # ------------------------------------------

        image_bytes = base64.b64decode(
            base64_image
        )


        # ------------------------------------------
        # Generate unique image key
        # ------------------------------------------

        image_key = (
            f"images/{uuid.uuid4()}.jpg"
        )


        # ------------------------------------------
        # Upload image to S3
        # ------------------------------------------

        s3.put_object(

            Bucket=BUCKET_NAME,

            Key=image_key,

            Body=image_bytes,

            ContentType="image/jpeg"

        )


        print(
            "Image uploaded:",
            image_key
        )


        # ------------------------------------------
        # Detect faces using Rekognition
        # ------------------------------------------

        response = rekognition.detect_faces(

            Image={

                "S3Object": {

                    "Bucket": BUCKET_NAME,

                    "Name": image_key

                }

            },

            Attributes=["DEFAULT"]

        )


        face_count = len(
            response["FaceDetails"]
        )


        print(
            "Face count:",
            face_count
        )


        # ------------------------------------------
        # Create statement
        # ------------------------------------------

        if face_count == 0:

            statement = (
                "No faces detected in the image."
            )

        elif face_count == 1:

            statement = (
                "One face detected in the image."
            )

        else:

            statement = (
                f"{face_count} faces detected "
                f"in the image."
            )


        # ------------------------------------------
        # Generate speech using Amazon Polly
        # ------------------------------------------

        polly_response = (
            polly.synthesize_speech(

                Text=statement,

                OutputFormat="mp3",

                VoiceId="Joanna"

            )
        )


        # ------------------------------------------
        # Generate unique audio key
        # ------------------------------------------

        audio_key = (
            f"audio/{uuid.uuid4()}.mp3"
        )


        # ------------------------------------------
        # Save Polly MP3 to S3
        # ------------------------------------------

        s3.put_object(

            Bucket=BUCKET_NAME,

            Key=audio_key,

            Body=polly_response[
                "AudioStream"
            ].read(),

            ContentType="audio/mpeg"

        )


        print(
            "Audio uploaded:",
            audio_key
        )


        # ------------------------------------------
        # Generate temporary audio URL
        # ------------------------------------------

        audio_url = (
            s3.generate_presigned_url(

                "get_object",

                Params={

                    "Bucket": BUCKET_NAME,

                    "Key": audio_key

                },

                ExpiresIn=3600

            )
        )


        # ------------------------------------------
        # Create SNS notification message
        # ------------------------------------------

        sns_message = (

            "Face Detection Result\n\n"

            f"Faces detected: {face_count}\n"

            f"Statement: {statement}\n\n"

            f"Image Key: {image_key}\n"

            f"Audio Key: {audio_key}\n\n"

            f"Audio URL:\n{audio_url}"

        )


        # ------------------------------------------
        # Publish notification to SNS
        # ------------------------------------------

        sns.publish(

            TopicArn=SNS_TOPIC_ARN,

            Subject="Face Detection Result",

            Message=sns_message

        )


        print(
            "SNS notification published successfully."
        )


        # ------------------------------------------
        # Return successful response
        # ------------------------------------------

        return {

            "statusCode": 200,

            "headers": {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*"

            },

            "body": json.dumps({

                "face_count":
                    face_count,

                "statement":
                    statement,

                "audio_url":
                    audio_url,

                "image_key":
                    image_key,

                "audio_key":
                    audio_key

            })

        }


    except Exception as e:

        print(
            "Lambda error:",
            str(e)
        )


        # ------------------------------------------
        # Return Error response
        # ------------------------------------------

        return {

            "statusCode": 500,

            "headers": {

                "Access-Control-Allow-Origin":
                    "*"

            },

            "body": json.dumps({

                "error":
                    str(e)

            })

        }