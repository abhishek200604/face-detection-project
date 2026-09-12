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
    const statementText = document.getElementById("statementText");

    const audioContainer = document.getElementById("audioContainer");
    const audioPlayer = document.getElementById("audioPlayer");

    const errorContainer = document.getElementById("errorContainer");
    const errorMessage = document.getElementById("errorMessage");

    let selectedFile = null;

    const API_URL =
        "https://jhu9t4dmuk.execute-api.ap-south-1.amazonaws.com/prod/upload";


    // --------------------------------------------------
    // Initial UI State
    // --------------------------------------------------

    resultContainer.hidden = true;
    audioContainer.hidden = true;
    errorContainer.hidden = true;
    imagePreview.hidden = true;
    resetButton.hidden = true;
    detectButton.disabled = true;


    // --------------------------------------------------
    // Open file picker
    // --------------------------------------------------

    uploadArea.addEventListener("click", () => {

        if (!selectedFile) {
            fileInput.click();
        }

    });


    // --------------------------------------------------
    // Prevent default drag behavior
    // --------------------------------------------------

    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {

        uploadArea.addEventListener(eventName, e => {

            e.preventDefault();
            e.stopPropagation();

        });

    });


    // --------------------------------------------------
    // Drag styling
    // --------------------------------------------------

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


    // --------------------------------------------------
    // Drag and drop
    // --------------------------------------------------

    uploadArea.addEventListener("drop", e => {

        handleFiles(e.dataTransfer.files);

    });


    // --------------------------------------------------
    // File picker
    // --------------------------------------------------

    fileInput.addEventListener("change", function () {

        handleFiles(this.files);

    });


    // --------------------------------------------------
    // Handle selected file
    // --------------------------------------------------

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
        audioContainer.hidden = true;

        // Completely reset previous audio
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();


        // Show image preview
        const reader = new FileReader();

        reader.onload = e => {

            imagePreview.src = e.target.result;
            imagePreview.hidden = false;

            uploadContent.hidden = true;

            detectButton.disabled = false;
            resetButton.hidden = false;

        };

        reader.onerror = () => {

            showError("Unable to read the selected image.");

        };

        reader.readAsDataURL(file);
    }


    // --------------------------------------------------
    // Reset
    // --------------------------------------------------

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

        faceCount.textContent = "0";
        statementText.textContent = "";


        // Properly reset audio
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();

        audioContainer.hidden = true;

        hideError();

    });


    // --------------------------------------------------
    // Detect faces
    // --------------------------------------------------

    detectButton.addEventListener("click", async e => {

        e.stopPropagation();


        // ----------------------------------------------
        // Validate image
        // ----------------------------------------------

        if (!selectedFile) {

            showError("Please select an image first.");

            return;
        }

        setLoadingState(true);

        hideError();

        resultContainer.hidden = true;
        audioContainer.hidden = true;


        try {

            // ------------------------------------------
            // Convert image to Base64
            // ------------------------------------------

            const base64Image = await fileToBase64(selectedFile);


            // ------------------------------------------
            // Create JSON request
            // ------------------------------------------

            const requestData = {

                image: base64Image

            };


            // ------------------------------------------
            // Send request to API Gateway
            // ------------------------------------------

            const response = await fetch(API_URL, {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify(requestData)

            });


            // ------------------------------------------
            // Read API response
            // ------------------------------------------

            const data = await response.json();

            console.log("API Response:", data);


            if (!response.ok) {

                throw new Error(
                    data.error || "Face detection failed."
                );

            }


            // ------------------------------------------
            // Validate face count
            // ------------------------------------------

            if (typeof data.face_count !== "number") {

                throw new Error(
                    "Invalid response from server."
                );

            }


            // ------------------------------------------
            // Display face count
            // ------------------------------------------

            faceCount.textContent = data.face_count;


            // ------------------------------------------
            // Display Lambda statement
            // ------------------------------------------

            if (data.statement) {

                statementText.textContent =
                    data.statement;

            } else {

                statementText.textContent = "";

            }


            // ------------------------------------------
            // Polly audio
            // ------------------------------------------

            if (
                typeof data.audio_url === "string" &&
                data.audio_url.trim() !== ""
            ) {

                console.log(
                    "Polly audio URL received."
                );


                // Stop previous audio
                audioPlayer.pause();

                // Remove previous source
                audioPlayer.removeAttribute("src");

                // Set NEW presigned S3 URL
                audioPlayer.src = data.audio_url;

                // Load new MP3
                audioPlayer.load();

                // Show audio section
                audioContainer.hidden = false;

            } else {

                console.warn(
                    "Lambda response did not contain audio_url."
                );

                audioContainer.hidden = true;

            }


            // ------------------------------------------
            // Show successful result
            // ------------------------------------------

            resultContainer.hidden = false;

        } catch (error) {

            console.error(
                "Detection error:",
                error
            );

            showError(
                error.message ||
                "Failed to process image."
            );

        } finally {

            setLoadingState(false);

        }

    });


    // --------------------------------------------------
    // Audio events
    // --------------------------------------------------

    audioPlayer.addEventListener("loadedmetadata", () => {

        console.log(
            "Audio metadata loaded:",
            audioPlayer.duration,
            "seconds"
        );

    });


    audioPlayer.addEventListener("canplay", () => {

        console.log(
            "Polly MP3 is ready to play."
        );

    });


    audioPlayer.addEventListener("loadeddata", () => {

        console.log(
            "Polly MP3 data loaded successfully."
        );

    });


    audioPlayer.addEventListener("error", () => {

        const mediaError = audioPlayer.error;

        console.error(
            "Audio loading error:",
            mediaError
                ? {
                    code: mediaError.code,
                    message: mediaError.message
                }
                : "Unknown audio error"
        );

        /*
         * Face detection can still succeed even if
         * the audio player has a separate problem.
         */

    });


    // --------------------------------------------------
    // Convert file to Base64
    // --------------------------------------------------

    function fileToBase64(file) {

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => {

                const result = reader.result;

                if (typeof result !== "string") {

                    reject(
                        new Error(
                            "Unable to convert image."
                        )
                    );

                    return;
                }

                const parts = result.split(",");

                if (parts.length < 2) {

                    reject(
                        new Error(
                            "Invalid image data."
                        )
                    );

                    return;
                }

                resolve(parts[1]);

            };


            reader.onerror = () => {

                reject(
                    new Error(
                        "Unable to read image."
                    )
                );

            };


            reader.readAsDataURL(file);

        });

    }


    // --------------------------------------------------
    // Loading state
    // --------------------------------------------------

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


    // --------------------------------------------------
    // Show error
    // --------------------------------------------------

    function showError(message) {

        errorMessage.textContent = message;

        errorContainer.hidden = false;

    }


    // --------------------------------------------------
    // Hide error
    // --------------------------------------------------

    function hideError() {

        errorContainer.hidden = true;

    }

});