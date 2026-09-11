# AWS Face Detection System

The AWS Face Detection System is a cloud-based serverless web application that allows users to upload an image through a clean web interface and automatically detect the number of human faces within it. The frontend sends the image through Amazon API Gateway to an AWS Lambda function, which temporarily stores the image in an Amazon S3 bucket, uses Amazon Rekognition to analyze the image, and returns the detected face count to the website while logging the result in Amazon CloudWatch. 

Additionally, the project supports a secondary backend-only workflow where images uploaded directly to the S3 bucket trigger the same Lambda function to process the image and log the results.

---

## Project Overview

The purpose of this project is to build an automated, scalable solution for face detection using managed AWS AI services. 

When a user selects an image and clicks the **Detect Faces** button, JavaScript reads the image file and sends it as a binary payload via an HTTP POST request. Amazon API Gateway receives this request, converts the binary payload into a Base64-encoded string, and proxies it to the AWS Lambda function. 

The Lambda function decodes the image back into binary format, generates a unique UUID-based filename, and uploads the image to Amazon S3. Once the image is in S3, Lambda calls Amazon Rekognition's `detect_faces` API, passing the S3 bucket and object name. Rekognition analyzes the image and returns a detailed JSON response. Lambda calculates the total number of faces by measuring the length of the `FaceDetails` array, creates a structured JSON response containing the face count, and includes the necessary CORS headers. API Gateway passes this response back to the browser, and JavaScript updates the web page to display the final result.

---

## Architecture

This project utilizes a single AWS Lambda function to handle two distinct event sources: REST API requests from the frontend and S3 ObjectCreated events from direct manual uploads.

```text
=========================================
          WORKFLOW 1: WEB UI
=========================================

 [ Browser / Web UI ]
          │
          ▼ (HTTP POST Image)
 [ Amazon API Gateway ] (/upload)
          │
          ▼ (Base64 Payload)
 [ AWS Lambda ] (FaceDetectionFunction)
          │
          ├──► [ Amazon S3 ] (Put Object)
          │
          ├──► [ Amazon Rekognition ] (Detect Faces)
          │
          └──► (JSON Response: face_count)
                   │
                   ▼
         [ Browser / Web UI ]


=========================================
      WORKFLOW 2: MANUAL S3 UPLOAD
=========================================

 [ Developer / User ]
          │
          ▼ (Upload Image)
 [ Amazon S3 ] (Bucket)
          │
          ▼ (ObjectCreated Event)
 [ AWS Lambda ] (FaceDetectionFunction)
          │
          ├──► [ Amazon Rekognition ] (Detect Faces)
          │
          └──► [ Amazon CloudWatch ] (Log Results)
```

**Workflow 1 Connections:** The browser communicates securely with API Gateway. API Gateway acts as the entry point and passes the request to Lambda. Lambda saves the image to S3, analyzes it via Rekognition, and responds back through the Gateway to the frontend.

**Workflow 2 Connections:** An image manually uploaded to S3 triggers an `s3:ObjectCreated:*` event. Lambda wakes up, extracts the bucket and filename from the event, calls Rekognition to analyze the image, and logs the face count directly into CloudWatch.

---

## Complete Data Flow

1. **Browser Request**: The user selects a JPG/PNG image and clicks "Detect Faces". JavaScript reads the image and sends it as a binary `Blob` to the API Gateway using an HTTP `POST` request.
2. **API Gateway Handling**: API Gateway is configured with Binary Media Types (`image/jpeg`, `image/png`). It takes the incoming binary request and automatically Base64-encodes it before sending it to the Lambda proxy integration.
3. **Lambda Event Processing**: Lambda receives the API event, checking for the presence of `httpMethod` or `requestContext`.
4. **Decoding & UUID Generation**: The Lambda function extracts the `body`, applies `base64.b64decode` to retrieve the original image bytes, and generates a unique filename using `uuid.uuid4()` (e.g., `web-upload-<uuid>.jpg`).
5. **S3 Storage**: Lambda uses the `boto3` S3 client's `put_object` method to store the image in the S3 bucket with `ContentType="image/jpeg"`.
6. **Amazon Rekognition**: Lambda invokes the `boto3` Rekognition client's `detect_faces` method, pointing it to the newly uploaded S3 object using the `S3Object` parameter.
7. **Counting Faces**: Rekognition returns a response containing a `FaceDetails` list. The function calculates the face count using `len(response["FaceDetails"])`.
8. **JSON Response**: Lambda formats a JSON object containing the filename and `face_count`.
9. **CORS Headers**: Lambda attaches `Access-Control-Allow-Origin: *` to the headers to satisfy browser security requirements.
10. **Frontend Rendering**: JavaScript receives the JSON, parses the `face_count`, hides the loading spinner, and dynamically updates the DOM to display the result badge.

---

## AWS Services Used

| AWS Service | Purpose in this Project |
|-------------|-------------------------|
| **Amazon S3** | Object storage. Stores uploaded images so Rekognition can access them. Also triggers Lambda on direct manual uploads. |
| **AWS Lambda** | The core compute backend. Handles API requests, processes images, triggers Rekognition, formats responses, and handles S3 events. |
| **Amazon Rekognition** | Deep learning image analysis service. Used specifically to identify and count human faces within images. |
| **Amazon API Gateway** | Provides the public-facing REST API endpoint (`/upload`) and routes HTTP requests from the frontend to Lambda. |
| **Amazon CloudWatch** | Central logging service. Captures all Lambda execution logs, `print()` statements, error messages, and detected face counts. |
| **AWS IAM** | Identity and Access Management. Provides secure permissions for Lambda to access S3/Rekognition and for GitHub Actions to update code. |
| **GitHub Actions** | Automated CI/CD pipeline. Automatically deploys updated Lambda code to AWS whenever changes are pushed to GitHub. |

---

## Project Resources and Configuration

This project is deployed to AWS with the following specific configurations:

- **S3 Bucket Name**: `face-detection-mini-project`
- **AWS Region**: `ap-south-1` (Mumbai)
- **Lambda Function Name**: `FaceDetectionFunction`
- **Lambda Runtime**: Python 3.13
- **Lambda Architecture**: x86_64
- **API Gateway REST API Name**: `FaceDetectionAPI`
- **API Gateway Resource Path**: `/upload`
- **HTTP Method**: `POST`
- **API Gateway Stage**: `prod`
- **Public API Endpoint**: `https://5oz155nsph.execute-api.ap-south-1.amazonaws.com/prod/upload`

---

## Frontend

The user interface consists of three local files:
- `index.html`: The markup structure containing a clean upload card, drag-and-drop zone, image preview area, action buttons, and result/error displays.
- `style.css`: Provides the professional layout, including fonts (Inter), hover effects, button styling, the loading spinner animation, and responsive behavior.
- `script.js`: Handles all interactive logic. It validates file types (`image/jpeg`, `image/png`), displays the image preview using `FileReader`, manages the loading state, and converts the file to Base64 and back to a binary Blob before sending it via `fetch()` to the API endpoint. It then handles the JSON response, updating the DOM with the face count or displaying relevant error messages.

---

## Lambda Function

The `lambda_function.py` script serves as the centralized backend handler. 

**Major Imports:**
- `json`: To parse and format JSON requests and responses.
- `boto3`: The AWS SDK for Python, used to create the `s3` and `rekognition` clients.
- `base64`: To decode the Base64 image payload sent by API Gateway.
- `uuid`: To generate collision-free unique filenames for web uploads.
- `urllib.parse`: To safely decode URL-encoded S3 object keys containing spaces or special characters.

**Execution Flow:**
The function uses an `if "httpMethod" in event or "requestContext" in event:` condition to dynamically determine if it was triggered by a website user or an internal AWS service.

For API Gateway, it parses the Base64 image, generates a `.jpg` UUID filename, uploads to S3, calls Rekognition, calculates the face count, and returns a 200 OK status with CORS headers and the JSON data. If any error occurs, the `except Exception as e` block catches it, logs it to CloudWatch, and returns a 500 error response.

For S3 ObjectCreated events, it traverses the `event["Records"]` dictionary to locate the `bucket` and `key`, decodes the URL-encoded key name, calls Rekognition on that specific object, logs the result to CloudWatch, and finishes execution. 

### Lambda Execution Logic

**Flow 1: API Gateway Invocation**
```text
Request received
  → Is it API Gateway?
  → Yes: decode image from Base64
  → generate unique UUID filename
  → upload to S3
  → call Rekognition detect_faces
  → count faces via len()
  → return JSON to API Gateway
```

**Flow 2: S3 Event Invocation**
```text
Request received
  → Is it S3 event?
  → read bucket and object key from event
  → decode URL-encoded object key
  → call Rekognition detect_faces
  → count faces via len()
  → log result to CloudWatch
```

---

## Amazon S3 Configuration

The S3 bucket `face-detection-mini-project` stores images prior to analysis. Because the bucket has an `s3:ObjectCreated:*` event configured to trigger the `FaceDetectionFunction` Lambda, manual file uploads via the AWS Console will successfully run the face detection logic and log the results to CloudWatch.

**Current Architectural Consideration:** Because the web-upload logic *also* writes the image to this exact same S3 bucket, web uploads currently invoke the Lambda function twice:
1. The synchronous API Gateway invocation (which responds to the user).
2. The asynchronous S3 ObjectCreated invocation triggered immediately after the API Gateway code successfully uploads the image.

This duplicate processing does not break the website, but it will result in two Rekognition API calls per web upload and two CloudWatch log entries.

---

## Amazon Rekognition

Amazon Rekognition is a powerful computer vision service. Instead of managing complex machine learning models, this project simply passes the S3 coordinates of the image to Rekognition's `detect_faces` API:

```python
response = rekognition.detect_faces(
    Image={
        "S3Object": {
            "Bucket": bucket_name,
            "Name": object_key
        }
    },
    Attributes=["DEFAULT"]
)
```

The API returns a dictionary containing a `FaceDetails` list. Every item in this list represents an identified human face. By simply measuring the length of this list (`len(response["FaceDetails"])`), the project determines the total face count.

---

## API Gateway

The Amazon API Gateway provides a REST API named `FaceDetectionAPI` deployed to the `prod` stage.

- **Resource:** `/upload`
- **Method:** `POST`
- **Integration:** Lambda Proxy Integration

Because images are binary data, API Gateway is specifically configured with Binary Media Types for `image/jpeg` and `image/png`. This ensures that incoming binary payloads are reliably converted to Base64 before being forwarded to Lambda. 

**Note on "Missing Authentication Token":** If you attempt to open the API URL directly in a browser, it sends an HTTP `GET` request. Because API Gateway only expects a `POST` request on `/upload`, the lack of a matching `GET` method results in the confusingly named default error: `{"message":"Missing Authentication Token"}`. This is expected behavior and means the route exists but rejects the HTTP method.

---

## API Request and Response

**Successful Response Example:**
```json
{
  "image": "web-upload-123e4567-e89b-12d3-a456-426614174000.jpg",
  "face_count": 7
}
```
- `image`: The unique UUID-based filename assigned by the Lambda function and stored in S3.
- `face_count`: The integer number of faces detected by Rekognition.

**Error Response Structure:**
```json
{
  "error": "Detailed error message string"
}
```

*Note: The API does not accept JSON input. The request body must be raw binary image data sent as a `POST` request.*

---

## CORS

Cross-Origin Resource Sharing (CORS) is a browser security feature that blocks web pages from making requests to a different domain unless explicitly permitted. 

Because `index.html` runs locally or on a separate hosting provider, the browser sends a preflight `OPTIONS` request to API Gateway before sending the image. API Gateway is configured to respond to this preflight request successfully. Following the preflight, the Lambda function explicitly includes the `"Access-Control-Allow-Origin": "*"` header in its 200 OK and 500 Error responses to allow the browser to safely read the JSON face count.

---

## IAM and Security

AWS Identity and Access Management (IAM) controls service permissions securely.

**Lambda Execution Role (`FaceDetectionLambdaRole`)**
This is the role attached to the running Lambda function. It utilizes the following policies:
- `AWSLambdaBasicExecutionRole`: Allows Lambda to write logs to CloudWatch.
- `AmazonS3FullAccess` / `AmazonS3ReadOnlyAccess`: Allows Lambda to read uploaded objects and write new web uploads.
- `AmazonRekognitionFullAccess`: Allows Lambda to send images to the Rekognition AI service.

**GitHub Actions Deployment Role (`GitHubActionsFaceDetectionDeployRole`)**
This role is strictly utilized by the CI/CD pipeline. Instead of executing the code, this role has permissions to update the `FaceDetectionFunction`'s code archive. It uses GitHub OIDC (OpenID Connect), which eliminates the need to store sensitive, long-lived AWS Access Keys inside GitHub repository secrets.

---

## CI/CD and Auto Deployment

This project utilizes GitHub Actions to automatically deploy code updates directly to AWS Lambda without requiring manual AWS Console interaction. 

The workflow is defined in `.github/workflows/deploy-lambda.yml`. When code is pushed to the `main` branch, the GitHub Action starts an Ubuntu runner, checks out the code, securely requests temporary AWS credentials via OIDC, creates a ZIP archive containing `lambda_function.py`, and triggers the AWS CLI `lambda update-function-code` command.

**CI/CD Architecture Flow:**
```text
[ Developer ]
      ↓
[ GitHub Repository ]
      ↓ (git push to main)
[ GitHub Actions ]
      ↓ (Requests short-lived credentials)
[ GitHub OIDC ]
      ↓ (Assumes AWS Role)
[ AWS IAM Deployment Role ]
      ↓ (Executes AWS CLI)
[ AWS Lambda UpdateFunctionCode ]
      ↓ 
[ FaceDetectionFunction Updated ]
```

**Workflow Configuration:**
```yaml
name: Deploy Lambda

on:
  push:
    branches:
      - main

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::358625410414:role/GitHubActionsFaceDetectionDeployRole
          aws-region: ap-south-1

      - name: Deploy Lambda
        run: |
          zip function.zip lambda_function.py
          aws lambda update-function-code \
            --function-name FaceDetectionFunction \
            --zip-file fileb://function.zip
```

---

## Repository Structure

```text
face-detection-project/
├── .github/
│   └── workflows/
│       └── deploy-lambda.yml
├── index.html
├── lambda_function.py
├── script.js
└── style.css
```

---

## How to Run the Project

The backend is completely serverless and permanently deployed to AWS. You do not need to install Node.js, Python, or start a local server to run the web application.

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/abhishek200604/face-detection-project.git
   cd face-detection-project
   ```
2. Open the `index.html` file directly in your web browser (double-click it).
3. Click the upload area to select a JPG or PNG image containing people.
4. Click **Detect Faces**.
5. Wait for the API request to complete and view the result!

---

## How to Modify and Deploy Lambda Code

To change how the backend behaves, utilize the automated CI/CD pipeline:

1. Open `lambda_function.py` in your code editor and make your modifications.
2. Save the file.
3. Add the changes to Git:
   ```bash
   git add lambda_function.py
   ```
4. Commit the changes:
   ```bash
   git commit -m "Updated Lambda detection logic"
   ```
5. Push to the main branch:
   ```bash
   git push origin main
   ```
6. GitHub Actions automatically detects the push and spins up a runner.
7. GitHub Actions safely authenticates using OIDC and deploys the new code to AWS.
8. Wait ~30 seconds, then test the updated API functionality directly on the website.

---

## Testing

Testing was performed at multiple layers of the system:
- **API Testing:** Verified via HTTP `POST` requests sending raw binary JPG data, successfully receiving a JSON response containing a face count of `7`.
- **Frontend Testing:** Selecting valid and invalid file formats, verifying the loading spinner functionality, and ensuring DOM updates.
- **Backend Logging Validation:** Validating the behavior by inspecting CloudWatch logs to confirm filename generation, Rekognition success, and event handling.

---

## CloudWatch Monitoring

Amazon CloudWatch acts as the debugging and monitoring system. The `lambda_function.py` uses simple `print()` statements to push data into the log streams:
- `Image uploaded from website: web-upload-...jpg`
- `Bucket: face-detection-mini-project`
- `Image: filename.jpg`
- `FACE DETECTION RESULT: X faces detected`
- `API Error: [error details]`

These logs are critical for verifying whether Rekognition returned the correct number of faces or diagnosing if an API Gateway request failed within the code.

---

## Troubleshooting

- **`{"message":"Missing Authentication Token"}`**: Occurs when trying to visit the API Gateway URL via a browser `GET` request. The API only accepts `POST`. Use the web UI to test.
- **CORS Errors in Browser Console**: Occurs if the Lambda function fails to execute cleanly and API Gateway returns a standard 500 error without the `Access-Control-Allow-Origin: *` header. Check CloudWatch logs for the actual Python error.
- **"Face detection failed" or Image format errors**: The API Gateway expects binary data. Ensure API Gateway is configured with Binary Media Types for `image/jpeg` and `image/png`.
- **Lambda Permission Errors**: If Lambda throws AccessDenied on S3 or Rekognition, verify that `FaceDetectionLambdaRole` has `AmazonS3FullAccess` and `AmazonRekognitionFullAccess`.
- **GitHub Actions deployment failures**: Often caused by an invalid `role-to-assume` ARN, mismatched region, or misconfigured OIDC trust relationships in the IAM role. Check the GitHub Actions logs.
- **Lambda not updating after a push**: Ensure you are pushing to the `main` branch, as the `deploy-lambda.yml` file is configured specifically for `main`.

---

## Known Limitations and Design Considerations

- **Image Extension Override**: In the current Lambda code for web uploads, the file is forcefully saved with a `.jpg` extension and `image/jpeg` Content-Type (`file_name = f"web-upload-{uuid.uuid4()}.jpg"`), even if the user uploaded a `.png` file.
- **Duplicate Execution**: As mentioned in the S3 Configuration section, website uploads currently result in two Lambda executions. The API Gateway triggers the first execution synchronously, and saving the image to S3 triggers the second asynchronous execution via `s3:ObjectCreated:*`.
- **Mini-Project Scope**: This is designed as an educational mini-project. It does not implement production-grade user authentication (Cognito), cost-control quotas, API rate limiting, or automated S3 object lifecycle deletion rules.

---

## Future Improvements

- **Prevent S3 Duplicate Execution**: Configure the S3 event trigger to use a specific prefix (e.g., `manual-uploads/`) to prevent web uploads from re-triggering the Lambda function.
- **Dynamic Content Types**: Extract the file extension from the incoming request or headers to accurately preserve `.png` extensions rather than defaulting to `.jpg`.
- **Image Cleanup**: Implement an S3 Lifecycle Rule to automatically delete uploaded images after 24 hours to reduce storage costs.
- **Enhanced Validation**: Add file size validation to both the frontend JavaScript and backend API Gateway to prevent excessively large payload charges.
- **Automated Tests**: Introduce `pytest` or `unittest` into the GitHub Actions workflow to run basic validation before deploying the Lambda function.
- **Restrict CORS**: Replace the wildcard `*` with the exact domain name once the website is hosted on a permanent URL.

---

## Security Notes

- **Never commit AWS credentials.** This repository uses GitHub Actions OIDC integration. It does not use or store static AWS Access Keys or Secret Keys in the code or GitHub secrets, ensuring credentials cannot be stolen or leaked.
- Do not expose any internal AWS ARNs unless absolutely necessary.
- The IAM deployment role adheres to the principle of least privilege, with permissions restricted strictly to updating `FaceDetectionFunction`.

---

## Learning Outcomes

By completing this mini-project, students and developers gain practical experience with:
- **AWS Lambda**: Creating serverless compute logic in Python.
- **Amazon API Gateway**: Designing REST APIs, managing Binary Media Types, and handling CORS.
- **Amazon S3**: Storing objects programmatically and understanding event-driven triggers.
- **Amazon Rekognition**: Interacting with managed deep-learning vision AI without training custom models.
- **Frontend-to-Cloud Integration**: Passing Base64/Binary payloads between vanilla JavaScript and cloud backends.
- **GitHub Actions & OIDC**: Implementing modern, secure, keyless CI/CD pipelines.

---

## Project Workflow Summary

```text
  [ Upload Image ]
          │
          ▼
[ Web UI (index.html) ]
          │
          ▼ (POST Request)
 [ Amazon API Gateway ]
          │
          ▼ (Triggers)
   [ AWS Lambda ] ───► [ Amazon S3 ] (Stores Image)
          │
          └───► [ Amazon Rekognition ] (Analyzes Image)
                      │
                      ▼ (Returns Face Count)
   [ AWS Lambda ] ───► [ CloudWatch ] (Logs Result)
          │
          ▼ (Returns JSON)
[ Web UI (Displays Result) ]
```

*(Note: Direct S3 uploads trigger the same Lambda and follow the rightward flow toward Rekognition and CloudWatch.)*

---

## Conclusion

The AWS Face Detection System demonstrates the power of serverless architecture by seamlessly bridging a local vanilla JavaScript frontend with complex, managed AWS machine learning services. Through the integration of S3, API Gateway, Lambda, and Rekognition, the project provides a highly scalable, fully automated, and secure face detection pipeline, maintained by a professional GitHub Actions CI/CD deployment strategy.
