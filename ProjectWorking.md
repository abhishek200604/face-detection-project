# ⏸️ Project Working and Operations Guide

This document is the permanent operational guide for the **AWS Face Detection System**.

This project operates in **TWO** operational states:
1. 🟢 **PROJECT WORKING / RUNNING**
2. 🔴 **PROJECT PAUSED / STOPPED**

> [!IMPORTANT]
> "PAUSED" does not mean deleting the project. The objective of pausing is to preserve the exact AWS configuration and CI/CD pipelines so that the project can be started again later without rebuilding, while minimizing costs.

---

## 🏗️ Current Architecture

The complete working architecture involves synchronous API processing augmented with AI and Notifications:

```text
                 🖥️ Web Application
                        │
                        ▼
              🌐 Amazon API Gateway
                  FaceDetectionAPI
                    POST /upload
                        │
                        ▼
                 ⚡ AWS Lambda
              FaceDetectionFunction
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       🪣 S3        👁️ Rekognition   🔊 Polly
          │             │             │
          │             ▼             ▼
          │        Face Count      MP3 Audio
          │                           │
          └──────────────┬────────────┘
                         ▼
                    📢 Amazon SNS
                         │
                         ▼
                    📧 Email
```

---

## 🛑 What "Pause" Means in Serverless

Unlike traditional web hosting, **serverless AWS architecture does not have a "Stop" button**.

- **AWS Lambda**: Idles and consumes zero compute time when there are no invocations.
- **Amazon API Gateway**: Waits passively for incoming HTTP requests.
- **Amazon Rekognition & Polly**: Only incur costs when explicitly called by Lambda.

### Resource State Differences
| Resource Type | Behavior | Action Required |
|---------------|----------|-----------------|
| **Compute (Lambda, AI)** | Effectively idle | Avoid invoking |
| **Storage (S3, CloudWatch)** | Accumulates passive charges | Delete objects / limit retention |
| **Config (IAM, Git, OIDC)** | Free to retain | **DO NOT DELETE** |

---

## ⏸️ PAUSE THE PROJECT

Follow this checklist to safely pause the project:

### 1️⃣ Stop Using the Website / API
- 🔍 **Check**: Ensure no users are actively clicking the website.
- 🛠️ **Action**: Stop clicking "Detect Faces". Do not send automated API requests.
- 💡 **Why**: Active usage invokes API Gateway, Lambda, S3, Polly, SNS, and Rekognition.

### 2️⃣ Prevent API Gateway Usage
- 🔍 **Check**: Endpoint is `https://jhu9t4dmuk.execute-api.ap-south-1.amazonaws.com/prod/upload`.
- 🛠️ **Action**: Stop POST requests. (Do NOT delete the API).
- 💡 **Why**: The REST API safely remains deployed while unused.

### 3️⃣ Leave Lambda and AI Services Alone
- 🔍 **Check**: `FaceDetectionFunction` exists.
- 🛠️ **Action**: None. Simply avoid invoking it.
- 💡 **Why**: Lambda, Rekognition, Polly, and SNS sit completely idle. Deleting them breaks the project permanently.

### 4️⃣ S3 Storage (Very Important)
- 🔍 **Check**: Review objects in `face-count-detection-project`.
- 🛠️ **Action**: Delete stored images and MP3s if absolute zero-cost is required.
- 💡 **Why**: Stored objects continuously incur tiny storage charges even when the project is paused.
- ⚠️ **Note**: **DO NOT delete the bucket itself.**

### 5️⃣ CloudWatch Logs
- 🔍 **Check**: Locate log group `/aws/lambda/FaceDetectionFunction`.
- 🛠️ **Action**: Change "Retention setting" to 1 or 3 days.
- 💡 **Why**: Ensures old logs automatically delete, preventing long-term storage fees.

### 6️⃣ IAM and CI/CD
- 🔍 **Check**: GitHub Actions, OIDC provider, and IAM Roles.
- 🛠️ **Action**: None. Do not push to the `main` branch.
- 💡 **Why**: IAM roles and workflows cost nothing to keep.

### ✅ Pause Verification Checklist
- [ ] No image uploads are being performed
- [ ] Website is not being used
- [ ] API Gateway receives no requests
- [ ] CloudWatch logs are not growing
- [ ] S3 object storage has been cleared (if desired)
- [ ] CloudWatch log retention limited
- [ ] S3 bucket, Lambda, API Gateway, IAM, and OIDC still exist!

---

## 🟢 How To START THE PROJECT AGAIN

Reverse the pause safely to bring the project back online:

### 1️⃣ Verify Region & Components
- Confirm region is `ap-south-1` (Mumbai).
- Check `face-count-detection-project` bucket exists.
- Check `FaceDetectionFunction` Lambda exists.
- Check `FaceDetectionAPI` exists.

### 2️⃣ Trigger CI/CD (If necessary)
- Push code to the `main` branch if you updated `lambda_function.py`.
- GitHub OIDC will securely deploy the code.

### 3️⃣ Test the System
- Open the website interface.
- Upload an image and click **Detect Faces**.
- Listen to the MP3 audio playback.
- Check your email inbox for the SNS notification.
- Verify CloudWatch logs for successful execution.

### ✅ Restart Verification Checklist
- [ ] Region is `ap-south-1`
- [ ] S3 bucket exists
- [ ] Lambda exists and code is current
- [ ] API Gateway `prod` stage exists
- [ ] API endpoint `jhu9t4dmuk...` works
- [ ] GitHub Actions completed successfully
- [ ] Rekognition returns a face count
- [ ] Polly returns audio
- [ ] SNS sends an email
- [ ] Website displays the result properly

---

## 📌 Cost Safety Rules
- **Do not run the website unnecessarily.**
- **Review S3 objects periodically** to avoid paying for massive image/audio storage.
- **Review CloudWatch log retention** so you do not store useless logs forever.
- **Never create a second Lambda function** just to test the existing project.
- **Never delete AWS resources** just to save money unless you intend to rebuild from scratch.

## 💰 AWS Billing Verification
To ensure your AWS account behaves as expected:
1. Navigate to **AWS Console → Billing and Cost Management**.
2. Filter charges by service and region (`ap-south-1`).
3. Monitor **S3**, **Lambda**, **API Gateway**, **Rekognition**, **Polly**, **SNS**, and **CloudWatch**.

---

## 🏁 Final Status
**The project configuration is permanently preserved and can transition between Working and Paused states seamlessly.**
