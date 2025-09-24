// define variables
let canvas;
let imageUploadButton;
let ctx;
let imgBase64;
let identifiedObjects = [];
let fillColor = "#b0b0b0ff";
// main functions
init();

function init(){
    initInterface();
    initInteraction();
}

function initInterface(){
    canvas = document.createElement('canvas');
    canvas.setAttribute('id', 'myCanvas');
    canvas.style.position = 'absolute';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.appendChild(canvas);
    
    ctx = canvas.getContext('2d');
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    imageUploadButton = document.createElement('button');
    imageUploadButton.setAttribute('id', 'imageUploadButton');
    imageUploadButton.innerText = 'Upload Image';
    imageUploadButton.style.position = 'absolute';
    imageUploadButton.style.left = '50%';
    imageUploadButton.style.top = '90%';
    imageUploadButton.style.transform = 'translate(-50%, -50%)';
    imageUploadButton.style.zIndex = '100';
    imageUploadButton.style.fontSize = '20px';
    imageUploadButton.style.fontFamily = 'Arial';
    document.body.appendChild(imageUploadButton);
}

function initInteraction(){
    imageUploadButton.addEventListener('click',()=>{
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        // Draw image to canvas
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        // Hide the upload button since image is loaded
                        imageUploadButton.style.display = 'none';
                        
                        // Capture full-size image for display
                        imgBase64 = canvas.toDataURL();
                        
                        // Create resized version for API calls (max 512px on longest side, preserving aspect ratio)
                        const resizedImgBase64 = resizeImagePreserveAspectRatio(img, 512);
                        
                        extractObject(resizedImgBase64).then(async (result)=>{
                            console.log("Extracted objects:", identifiedObjects);
                            
                            // Generate images for each identified object
                            console.log("Generating images...");
                            const generatedImgs = await generateImgs(resizedImgBase64, identifiedObjects);
                            console.log("Generated images:", generatedImgs);
                            
                            // Display all images in a 3x2 grid (original + 5 generated)
                            displayImagesGrid([imgBase64, ...generatedImgs]);
                        });
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
        input.click();
    });
}

async function extractObject(base64Img){
    let vlm = "anthropic/claude-4-sonnet";
    let prompt = `
    Extract at most 4 important features from the photograph. For each feature, describe a category that it belongs to, and provide 5 other objects that are in the same category.
    You can identify fewer than 4 features if there are not that many important features in the photograph.
    The feature can be objects, weather, angle of view, and lighting.
    Following the following example and only respond with a JSON object:
    Example:
    [{"feature":"sedan car","category":"vehicle","similar_features":["suv","truck","motorcycle","bicycle","bus"]},{"feature":"eye-Level shot","category":"camera position","similar_features":["closeup","low-angle","high-angle","dutch angle","long shot"]}]
    `;
    let data = {
        model: vlm,
        input:{
            prompt: prompt,
            image: base64Img,
            max_tokens: 8192,
            system_prompt: "You are a helpful assistant",
            extended_thinking: false,
            max_image_resolution: 0.5,
            thinking_budget_tokens: 1024
        }
    }
    const url = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    let authToken = "";
    const payload = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
    };
    const raw_response = await fetch(url, payload);
    const json_response = await raw_response.json();
    console.log("VLM response:", json_response);
    identifiedObjects = JSON.parse(json_response.output.join(""));
    return json_response;
}

async function generateImgs(img, identifiedObjects){
    let generationModel = "google/nano-banana";
    let imgArr = [];
    
    // randomly choose an index from the lngth of identifiedObjects
    const randomIndex = Math.floor(Math.random() * identifiedObjects.length);
    const randomObject = identifiedObjects[randomIndex];
    

    for(let obj of randomObject["similar_features"]){
        let prompt = `edit the following image. replace the ${randomObject.feature} in the image with ${obj}, and keep all other elements the same`;
        let data = {
            model: generationModel,
            input:{
                image_input: [img],
                prompt: prompt,
                output_format: "jpg"
            }
        }
    
        const url = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
        let authToken = "";
        const payload = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(data),
        };
        
        try {
            const raw_response = await fetch(url, payload);
            const json_response = await raw_response.json();
            
            // Extract the image URL from nano-banana response format
            if(json_response.output) {
                imgArr.push(json_response.output);
                console.log("Generating images...");
            } else {
                console.error("No output in response:", json_response);
            }
        } catch (error) {
            console.error("Error generating image for", obj.object, ":", error);
        }
    }
    return imgArr;
}

function displayImagesGrid(imageUrls) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate grid dimensions (3 columns, 2 rows)
    const cols = 3;
    const rows = 2;
    const padding = 20;
    const imgWidth = (canvas.width - (padding * (cols + 1))) / cols;
    const imgHeight = (canvas.height - (padding * (rows + 1))) / rows;
    
    let loadedCount = 0;
    const totalImages = Math.min(imageUrls.length, 6);
    
    imageUrls.slice(0, 6).forEach((imgUrl, index) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Handle CORS for external images
        
        img.onload = () => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = padding + col * (imgWidth + padding);
            const y = padding + row * (imgHeight + padding);
            
            // Calculate aspect ratio and fit image within cell while preserving proportions
            const imgAspectRatio = img.width / img.height;
            const cellAspectRatio = imgWidth / imgHeight;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (imgAspectRatio > cellAspectRatio) {
                // Image is wider - fit to width
                drawWidth = imgWidth;
                drawHeight = imgWidth / imgAspectRatio;
                drawX = x;
                drawY = y + (imgHeight - drawHeight) / 2;
            } else {
                // Image is taller - fit to height
                drawHeight = imgHeight;
                drawWidth = imgHeight * imgAspectRatio;
                drawX = x + (imgWidth - drawWidth) / 2;
                drawY = y;
            }
            
            // Draw image with preserved aspect ratio
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            
            loadedCount++;
            if (loadedCount === totalImages) {
                console.log("All images loaded and displayed");
            }
        };
        
        img.onerror = () => {
            console.error("Failed to load image:", imgUrl);
            loadedCount++;
        };
        
        // Handle both base64 and URL formats
        if (typeof imgUrl === 'string') {
            img.src = imgUrl;
        }
    });
}

function resizeImagePreserveAspectRatio(img, maxSize) {
    // Create a temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate new dimensions while preserving aspect ratio
    let newWidth, newHeight;
    
    if (img.width > img.height) {
        // Landscape: limit width to maxSize
        newWidth = Math.min(img.width, maxSize);
        newHeight = (img.height * newWidth) / img.width;
    } else {
        // Portrait or square: limit height to maxSize
        newHeight = Math.min(img.height, maxSize);
        newWidth = (img.width * newHeight) / img.height;
    }
    
    // Set canvas dimensions to calculated size
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    
    // Draw the resized image
    tempCtx.drawImage(img, 0, 0, newWidth, newHeight);
    
    console.log(`Resized image from ${img.width}x${img.height} to ${newWidth}x${newHeight}`);
    
    // Return as base64 with good compression
    return tempCanvas.toDataURL('image/jpeg', 0.8);
}

function resizeImageToBase64(img, targetWidth, targetHeight) {
    // Create a temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Set canvas dimensions to target size
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    
    // Calculate scaling to maintain aspect ratio
    const imgAspectRatio = img.width / img.height;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspectRatio > targetAspectRatio) {
        // Image is wider - fit to width, crop height
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgAspectRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
    } else {
        // Image is taller - fit to height, crop width
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgAspectRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
    }
    
    // Fill with background color first (optional)
    tempCtx.fillStyle = '#000000';
    tempCtx.fillRect(0, 0, targetWidth, targetHeight);
    
    // Draw the resized image
    tempCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    
    // Return as base64
    return tempCanvas.toDataURL('image/jpeg', 0.8); // 0.8 quality for smaller file size
}