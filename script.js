document.addEventListener("DOMContentLoaded", () => {

    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("fileInput");
    const uploadContent = document.getElementById("uploadContent");
    const imagePreview = document.getElementById("imagePreview");
    const detectButton = document.getElementById("detectButton");
    const resetButton = document.getElementById("resetButton");
    const spinner = document.getElementById("spinner");
    const btnText = document.querySelector(".btn-text");
    const resultContainer = document.getElementById("resultContainer");
    const faceCount = document.getElementById("faceCount");
    const errorContainer = document.getElementById("errorContainer");
    const errorMessage = document.getElementById("errorMessage");

    let selectedFile = null;

    const API_URL =
        "https://5oz155nsph.execute-api.ap-south-1.amazonaws.com/prod/upload";


    // Open file picker
    uploadArea.addEventListener("click", () => {
        fileInput.click();
    });


    // Prevent default drag behavior
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        uploadArea.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });


    // Drag styling
    ["dragenter", "dragover"].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove("dragover");
        });
    });


    // Drag and drop
    uploadArea.addEventListener("drop", e => {
        handleFiles(e.dataTransfer.files);
    });


    // File picker
    fileInput.addEventListener("change", function () {
        handleFiles(this.files);
    });


    // Handle selected file
    function handleFiles(files) {

        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];

        const validTypes = [
            "image/jpeg",
            "image/png"
        ];

        if (!validTypes.includes(file.type)) {
            showError("Please select a JPG, JPEG, or PNG image.");
            return;
        }

        selectedFile = file;

        hideError();
        resultContainer.hidden = true;

        // Show image preview
        const reader = new FileReader();

        reader.onload = e => {
            imagePreview.src = e.target.result;
            imagePreview.hidden = false;

            uploadContent.hidden = true;

            detectButton.disabled = false;
            resetButton.hidden = false;
        };

        reader.readAsDataURL(file);
    }


    // Reset
    resetButton.addEventListener("click", e => {

        e.stopPropagation();

        selectedFile = null;
        fileInput.value = "";

        imagePreview.src = "";
        imagePreview.hidden = true;

        uploadContent.hidden = false;

        detectButton.disabled = true;
        resetButton.hidden = true;

        resultContainer.hidden = true;

        hideError();
    });


    // Detect faces
    detectButton.addEventListener("click", async e => {

        e.stopPropagation();

        if (!selectedFile) {
            showError("Please select an image first.");
            return;
        }

        setLoadingState(true);
        hideError();
        resultContainer.hidden = true;

        try {

            // Convert image to Base64
            const base64Image = await fileToBase64(selectedFile);

            const response = await fetch(API_URL, {
                method: "POST",

                headers: {
                    "Content-Type": selectedFile.type
                },

                body: base64ToBlob(base64Image, selectedFile.type)
            });


            const data = await response.json();

            console.log("API Response:", data);


            if (!response.ok) {
                throw new Error(data.error || "Face detection failed.");
            }


            // Our Lambda returns:
            // {
            //   image: "...",
            //   face_count: 7
            // }

            if (typeof data.face_count !== "number") {
                throw new Error("Invalid response from server.");
            }


            // Show result
            faceCount.textContent = data.face_count;

            resultContainer.hidden = false;

        } catch (error) {

            console.error("Detection error:", error);

            showError(error.message || "Failed to process image.");

        } finally {

            setLoadingState(false);
        }
    });


    // Convert file to Base64
    function fileToBase64(file) {

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => {
                resolve(reader.result.split(",")[1]);
            };

            reader.onerror = reject;

            reader.readAsDataURL(file);
        });
    }


    // Convert Base64 to binary
    function base64ToBlob(base64, contentType) {

        const byteCharacters = atob(base64);

        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 1024) {

            const slice = byteCharacters.slice(offset, offset + 1024);

            const byteNumbers = new Array(slice.length);

            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            byteArrays.push(new Uint8Array(byteNumbers));
        }

        return new Blob(byteArrays, {
            type: contentType
        });
    }


    // Loading state
    function setLoadingState(isLoading) {

        detectButton.disabled = isLoading;

        if (isLoading) {

            btnText.textContent = "Processing...";
            spinner.hidden = false;

        } else {

            btnText.textContent = "Detect Faces";
            spinner.hidden = true;
        }
    }


    // Show error
    function showError(message) {

        errorMessage.textContent = message;
        errorContainer.hidden = false;
    }


    // Hide error
    function hideError() {

        errorContainer.hidden = true;
    }

});
