# Project Working and Operations Guide

This document is the permanent operational guide for the **AWS Face Detection System**. 

This project operates in **TWO** operational states:
1. **PROJECT WORKING / RUNNING**
2. **PROJECT PAUSED / STOPPED**

**IMPORTANT:** "PAUSED" does not mean deleting the project. The objective of pausing is to preserve the exact AWS configuration and CI/CD pipelines so that the project can be started again later without having to rebuild everything from scratch, while minimizing or eliminating ongoing costs.

---

## Current Architecture

Below is the complete working architecture of the AWS Face Detection System. Note that the **SAME** AWS Lambda function handles both event sources.

```text
=========================================
          WORKFLOW 1: WEB UI
=========================================

          [ User ]
             ↓
[ HTML / CSS / JavaScript Website ]
             ↓
     [ API Gateway ]
     FaceDetectionAPI
      POST /upload
             ↓
  [ FaceDetectionFunction ]
        AWS Lambda
             ↓
        [ Amazon S3 ]
 face-detection-mini-project
             ↓
    [ Amazon Rekognition ]
         DetectFaces
             ↓
        [ Face Count ]
             ↓
 [ API Gateway Response ]
             ↓
         [ Website ]

=========================================
      WORKFLOW 2: MANUAL S3 UPLOAD
=========================================

    [ Manual Image Upload ]
             ↓
  [ S3 ObjectCreated Event ]
             ↓
  [ FaceDetectionFunction ]
             ↓
    [ Amazon Rekognition ]
             ↓
     [ CloudWatch Logs ]
```

---

## IMPORTANT: What "Pause" Means

Unlike traditional web hosting or EC2 virtual machines, **serverless AWS architecture does not have a "Stop" or "Power Off" button**.

- **AWS Lambda** does not continuously run. It is effectively idle and consumes zero compute time when there are no invocations.
- **Amazon API Gateway** does not require a server to be stopped. The API simply waits for incoming HTTP requests.
- **Amazon Rekognition** only processes data and incurs costs when explicitly called by Lambda.

Therefore, the main goal of pausing this project is to prevent accidental or automatic future invocations, and to control resources that can accumulate passive storage or log charges.

**Understand the difference between:**
* **Resources that are effectively idle:** Compute services (Lambda, Rekognition) normally do not generate meaningful charges when unused.
* **Resources that can accumulate charges:** Storage services (S3 objects, CloudWatch Logs) charge for the amount of data stored over time.
* **Resources that should have triggers disabled:** S3 event notifications should be disconnected to prevent accidental automated executions.
* **Resources that must NOT be deleted:** Configuration, IAM roles, the S3 bucket itself, and Lambda code must be kept to easily resume the project.

---

## PAUSE THE PROJECT

Follow this strict, pointwise procedure to safely pause the project.

### STEP 1 — STOP USING THE WEBSITE / API
* **AWS Console Service:** N/A (Local/Web)
* **What to check:** Ensure no users are actively clicking the website.
* **What action to perform:** Stop clicking the "Detect Faces" button and do not send automated requests to the API.
* **Why we are doing it:** Simply closing the browser is not an AWS shutdown operation; it just prevents you from intentionally triggering the API. Active usage invokes API Gateway, Lambda, S3, and Rekognition.
* **What should be visible:** No new API traffic.
* **Is it reversible:** Yes, just open the website again.

### STEP 2 — DISABLE THE S3 → LAMBDA TRIGGER
* **AWS Console Service:** Amazon S3
* **Navigation Path:** Amazon S3 → Buckets → `face-detection-mini-project` → Properties → Event notifications
* **What to check:** Locate the active `ObjectCreated` event notification that targets `FaceDetectionFunction`.
* **What action to perform:** Delete or disable this specific event notification.
* **Why we are doing it:** If an image is manually uploaded to the S3 bucket while this trigger is active, S3 automatically invokes Lambda, which then invokes Rekognition. Removing the notification prevents accidental automated executions. This does NOT delete your bucket, Lambda, or code.
* **What should be visible:** The Event notifications list should be empty or have the specific Lambda trigger removed.
* **Is it reversible:** Yes. This trigger must be restored during the START procedure.

### STEP 3 — PREVENT API GATEWAY USAGE
* **AWS Console Service:** Amazon API Gateway
* **Navigation Path:** API Gateway → `FaceDetectionAPI`
* **What to check:** Ensure the REST API endpoint is `https://5oz155nsph.execute-api.ap-south-1.amazonaws.com/prod/upload`.
* **What action to perform:** Do not send any POST requests to the endpoint. (Optional: If you wish to strictly block it, you can remove the POST method or delete the `prod` stage, but this requires redeployment later).
* **Why we are doing it:** API Gateway does not behave like a server that powers off. The REST API safely remains deployed while unused.
* **What should be visible:** The API remains deployed but receives 0 requests.
* **Is it reversible:** Yes. **Do NOT delete `FaceDetectionAPI`.**

### STEP 4 — LAMBDA
* **AWS Console Service:** AWS Lambda
* **Navigation Path:** Lambda → Functions → `FaceDetectionFunction`
* **What to check:** Confirm the function exists.
* **What action to perform:** None. Simply avoid invoking it.
* **Why we are doing it:** Lambda has no Start/Stop button. It is effectively idle. Deleting it would break the API, S3 integrations, and GitHub Actions, requiring a complete project rebuild.
* **What should be visible:** The function remains untouched.
* **Is it reversible:** N/A. **Do NOT delete `FaceDetectionFunction`.**

### STEP 5 — AMAZON REKOGNITION
* **AWS Console Service:** Amazon Rekognition
* **What action to perform:** None.
* **Why we are doing it:** Rekognition is an on-demand service. No server needs to be stopped. As long as no `DetectFaces` requests are made by Lambda, the service does not actively consume processing.

### STEP 6 — S3 STORAGE (VERY IMPORTANT)
* **AWS Console Service:** Amazon S3
* **Navigation Path:** Amazon S3 → Buckets → `face-detection-mini-project` → Objects
* **What to check:** Look at the images currently stored in your bucket.
* **What action to perform:** Choose Option A or Option B.
  * **OPTION A — SAFE PAUSE / PRESERVE DATA:** Keep the stored objects. This preserves your test images but may continue to incur small AWS storage charges based on total size.
  * **OPTION B — ZERO-STORAGE APPROACH:** Select all images and click **Delete**. This empties the objects from the S3 bucket but keeps the bucket itself intact.
* **Why we are doing it:** Stored objects continuously incur storage charges even when the project is not actively being used.
* **Is it reversible:** Option A is reversible. Option B permanently deletes the images. **Do NOT delete the bucket itself.**

| Choice | Data preserved? | Future S3 storage charge? | Easy restart? |
|--------|-----------------|---------------------------|---------------|
| Safe pause | Yes | Possible | Yes |
| Empty bucket | No | No object-storage charge | Yes |

*(Note: Emptying the bucket eliminates S3 object-storage charges, but does not guarantee absolute zero AWS billing due to other account-level resources).*

### STEP 7 — CLOUDWATCH LOGS
* **AWS Console Service:** Amazon CloudWatch
* **Navigation Path:** CloudWatch → Logs → Log groups
* **What to check:** Locate the Lambda log group: `/aws/lambda/FaceDetectionFunction`.
* **What action to perform:** Click on the log group, find "Retention setting", and change it to a short period (e.g., 1 day or 3 days).
* **Why we are doing it:** CloudWatch Logs can continue to consume storage charges after the project is paused. Changing retention ensures old logs automatically delete. New logs stop generating because Lambda is not invoked.
* **Is it reversible:** Yes, you can change retention back to "Never expire" later. **Do NOT delete the CloudWatch log group as the default action.**

### STEP 8 — IAM
* **AWS Console Service:** IAM
* **What action to perform:** Keep the roles `FaceDetectionLambdaRole` and `GitHubActionsFaceDetectionDeployRole`.
* **Why we are doing it:** IAM roles and policies are configuration items, not running compute resources. They do not cost money to exist. Keeping them makes restarting the project effortless. **Do NOT delete IAM roles.**

### STEP 9 — GITHUB ACTIONS / OIDC
* **Service:** GitHub
* **What action to perform:** Stop pushing code to the `main` branch.
* **Why we are doing it:** The workflow `.github/workflows/deploy-lambda.yml` runs only on a `git push`. Leaving the repository alone does not continuously run the workflow. Keep the GitHub OIDC provider and the deployment role because they are required for automatic deployment when development resumes.

### STEP 10 — VERIFY THE PROJECT IS PAUSED

#### Pause Verification Checklist
- [ ] S3 ObjectCreated → Lambda notification is disabled
- [ ] No image uploads are being performed
- [ ] Website is not being used
- [ ] API Gateway receives no requests
- [ ] Lambda has no expected invocations
- [ ] Rekognition has no expected requests
- [ ] CloudWatch logs are not continuously growing
- [ ] S3 object storage has been reviewed
- [ ] CloudWatch log retention has been reviewed
- [ ] Lambda function still exists
- [ ] API Gateway still exists
- [ ] S3 bucket still exists
- [ ] Lambda execution role still exists
- [ ] GitHub Actions deployment role still exists
- [ ] GitHub OIDC provider still exists
- [ ] GitHub repository and workflow still exist

**The final goal is:**
# PROJECT PAUSED
No intentional application traffic  
\+ No S3 automatic Lambda trigger  
\+ No active Lambda processing  
\+ No Rekognition processing  
\+ Controlled S3 storage  
\+ Controlled CloudWatch log storage  
\+ All configuration preserved

---

## What NOT To Delete

To ensure the project can be safely resumed, **do not delete** the following resources:
* `face-detection-mini-project` (S3 Bucket)
* `FaceDetectionFunction` (Lambda Function)
* `FaceDetectionAPI` (API Gateway)
* `FaceDetectionLambdaRole` (IAM Role)
* `GitHubActionsFaceDetectionDeployRole` (IAM Role)
* GitHub OIDC provider `token.actions.githubusercontent.com`
* `.github/workflows/deploy-lambda.yml` (GitHub Actions Workflow)
* GitHub repository
* Frontend files (`index.html`, `style.css`, `script.js`)
* `lambda_function.py` (Source code)

---

## Resources That Do NOT Need To Be Stopped
These resources do not behave like an EC2 virtual machine that continuously runs. They sit idle when not invoked:
* **Lambda**
* **API Gateway**
* **Rekognition**
* **IAM**
* **GitHub repository**
* **GitHub OIDC**

## Resources That CAN Continue To Cost Money While Paused
* **S3 Object Storage:** You are billed for gigabytes stored per month.
* **CloudWatch Logs Storage:** You are billed for gigabytes of log data retained per month.
* **Other AWS Services:** Any resources you created outside of this specific project.

---

## How To START THE PROJECT AGAIN

Follow this procedure to reverse the pause safely and bring the project back online.

### STEP 1: Verify Region
Confirm you are in the correct AWS region: `ap-south-1` (Asia Pacific - Mumbai).

### STEP 2: Restore S3 Trigger
* **Navigate:** S3 → `face-detection-mini-project` → Properties → Event notifications
* **Action:** Create/Re-enable the `s3:ObjectCreated:*` notification.
* **Target:** Select the existing Lambda function: `FaceDetectionFunction`. 
* **Important:** Do not create a brand new Lambda function here.

### STEP 3: Check Lambda
* **Navigate:** Lambda → Functions → `FaceDetectionFunction`
* **Verify:** Ensure the function exists, the runtime is Python 3.13, code is present, and the function is available. (Do not manually paste code if you are using GitHub Actions).

### STEP 4: Check API Gateway
* **Navigate:** API Gateway → `FaceDetectionAPI` → Resources
* **Verify:** Ensure `/upload` and `POST` exist. Verify the `prod` stage exists.
* **Verify Endpoint:** `https://5oz155nsph.execute-api.ap-south-1.amazonaws.com/prod/upload`
* **Note:** If you did not delete or disable the API during the pause, no redeployment is needed.

### STEP 5: Check GitHub Actions
* **Verify:** The deployment workflow is `.github/workflows/deploy-lambda.yml` triggered on the `main` branch.
* **Action:** If you updated `lambda_function.py` locally while paused, simply push to `main`. GitHub OIDC will automatically assume the IAM role and deploy the code. Wait for the Action to complete successfully.

### STEP 6: Test Lambda / API
* **Test:** Use the website interface or an API tool (like Thunder Client) to send a POST request with an image.
* **Expected Output:**
  ```json
  {
    "image": "web-upload-<uuid>.jpg",
    "face_count": 7
  }
  ```

### STEP 7: Test S3 Trigger
* **Test:** Manually upload a test image to the `face-detection-mini-project` bucket.
* **Verify:** The `ObjectCreated` notification should invoke Lambda automatically.

### STEP 8: Check CloudWatch
* **Navigate:** CloudWatch → Logs → Log groups → `/aws/lambda/FaceDetectionFunction`
* **Verify:** Inspect the latest log stream to see:
  `Bucket: face-detection-mini-project`
  `Image: ...`
  `FACE DETECTION RESULT: X faces detected`

#### Restart Verification Checklist
- [ ] Region is ap-south-1
- [ ] S3 bucket exists
- [ ] S3 ObjectCreated notification is enabled
- [ ] Lambda exists
- [ ] Lambda code is current
- [ ] API Gateway exists
- [ ] `/upload` POST exists
- [ ] `prod` stage exists
- [ ] API endpoint works
- [ ] GitHub Actions works
- [ ] Rekognition returns a face count
- [ ] CloudWatch shows the invocation
- [ ] Website displays the result

---

## Pause vs Start Quick Reference

| Component      | PAUSE ACTION                               | START ACTION                                  |
| -------------- | ------------------------------------------ | --------------------------------------------- |
| **Website**    | Do not use                                 | Open/use website                              |
| **S3**         | Disable trigger; optionally remove objects | Restore trigger; optionally upload test image |
| **Lambda**     | Leave function; do not invoke              | Leave function; test it                       |
| **API Gateway**| Leave deployed; no requests                | Use endpoint                                  |
| **Rekognition**| No requests                                | Automatically used by Lambda                  |
| **CloudWatch** | Review/limit log retention                 | Monitor logs                                  |
| **IAM**        | Keep roles                                 | Keep roles                                    |
| **GitHub Actions** | No pushes                              | Push code when needed                         |
| **OIDC**       | Keep provider                              | Keep provider                                 |

---

## Cost Safety Rules

1. Do not run the website unnecessarily.
2. Do not repeatedly test images when the project is paused.
3. Do not manually upload images to S3 while the S3 trigger is enabled unless testing.
4. Review S3 objects periodically to avoid paying for massive image storage.
5. Review CloudWatch log retention so you do not store useless logs forever.
6. Do not create additional AWS services unless necessary.
7. Never create a second Lambda function just to test the existing project.
8. Never create a second API Gateway unnecessarily.
9. Keep the project in the `ap-south-1` region to avoid cross-region confusion.
10. Check AWS Billing/Cost Explorer a few days after completing the pause procedure.

---

## AWS Billing Verification

To ensure your AWS account is behaving as expected while paused:
* **Navigate:** AWS Console → Billing and Cost Management → Bills / Cost Explorer
* **What to inspect:** Filter charges by service and region (`ap-south-1`).
* **Relevant Services:** Monitor Amazon S3, AWS Lambda, Amazon API Gateway, Amazon Rekognition, and Amazon CloudWatch.
* **Note:** Billing information may not update instantly. The absence of current usage does not necessarily mean the billing page immediately reflects zero.

---

## Important Architecture Note

There is a subtle architectural design consideration in the current working implementation. 

The web-upload flow proceeds as follows:
Website → API Gateway → Lambda → S3 `put_object` → Rekognition

However, the **SAME** S3 bucket (`face-detection-mini-project`) also has an `ObjectCreated` trigger connected to the **SAME** Lambda function. 

Therefore, when a website upload stores an image in the S3 bucket, that S3 object creation will immediately trigger the S3 notification event. This causes a **second** Lambda invocation and a **second** Rekognition processing request for the exact same web-uploaded image.

*This is a known behavior of the current project design.*

**Possible Future Solutions (For Reference Only):**
* Implement an S3 prefix filter (e.g., triggering only on `manual-uploads/`).
* Use a separate S3 bucket entirely for web uploads vs. manual processing.
* Add logic to the Lambda function to ignore files starting with `web-upload-`.

---

## Complete Project Lifecycle

```text
       PROJECT DEVELOPMENT
               ↓
     AWS RESOURCES CREATED
               ↓
         PROJECT TESTED
               ↓
 GITHUB AUTO DEPLOYMENT ENABLED
               ↓
         PROJECT PAUSED
               ↓
    AWS RESOURCES PRESERVED
               ↓
      PROJECT STARTED AGAIN
               ↓
             TEST
               ↓
          PAUSE AGAIN
```

---

## One-Page Cheat Sheet

**PAUSE:**
1. Disable S3 ObjectCreated → Lambda trigger.
2. Stop using the website/API.
3. Review S3 stored images (delete objects if zero-storage desired).
4. Review CloudWatch log retention.
5. Keep Lambda intact.
6. Keep API Gateway intact.
7. Keep IAM intact.
8. Keep GitHub/OIDC intact.
9. Check AWS Billing after a few days.

**START:**
1. Enable S3 ObjectCreated → Lambda trigger.
2. Check Lambda configuration.
3. Check API Gateway `/upload` POST.
4. Check `prod` stage.
5. Push code to GitHub if updates are needed.
6. Test website/API.
7. Check CloudWatch Logs.
8. Test S3 manual upload.
9. Monitor Billing.

---

> **WARNING:**  
> DO NOT DELETE THE AWS RESOURCES JUST TO SAVE MONEY UNLESS YOU INTENTIONALLY WANT TO REBUILD THE PROJECT FROM SCRATCH.

The purpose of this guide is to safely pause and resume the existing infrastructure without losing your architecture or CI/CD setup.
