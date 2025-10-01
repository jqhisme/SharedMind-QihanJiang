let canvas;
let ctx;
let currentText = '';
let textLines = [];
let maxLineWidth = 600; // pixels
let fontSize = 24;
let lineHeight = 36;
let inputEmbedding = null;
let visualizationData = null;
let isUpdatingEmbedding = false;
let lastUpdateTime = 0;
let updateDelay = 1000; // Wait 1 second after typing stops

let firstTimeGetEmbedding = true;
//let maxDistance = 0;

let wordLs = words.split('\n----\n');
wordLs = wordLs.filter(i => i !== ""); // remove empty elements


init();

function init(){
    // canvas
    canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.border = 'none'; // Remove any border around the canvas
    ctx = canvas.getContext("2d");
    document.body.appendChild(canvas);

    // Load Inter font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Setup keyboard listeners
    setupKeyboardListeners();
    
    // Make canvas focusable and focused
    canvas.tabIndex = 0;
    canvas.focus();
    
    // Initial render after font loads
    setTimeout(() => {
        setupTextRendering();
        renderText();
    }, 100);
}

function setupTextRendering() {
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
}

function setupKeyboardListeners() {
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('paste', (event) => {
        event.preventDefault();
        const pasteData = event.clipboardData.getData('text');
        currentText += pasteData;
        updateTextLines();
    });
}

function handleKeyDown(event) {
    event.preventDefault();
    
    if (event.key === 'Backspace') {
        if (currentText.length > 0) {
            currentText = currentText.slice(0, -1);
            updateTextLines();
        }
    } else if (event.key === 'Enter') {
        currentText += '\n';
        updateTextLines();
    } else if (event.key.length === 1) {
        currentText += event.key;
        updateTextLines();
    }
}

function updateTextLines() {
    textLines = [];
    const words = currentText.split(' ');
    let currentLine = '';
    
    ctx.font = `${fontSize}px Inter, sans-serif`;
    
    for (let word of words) {
        // Handle manual line breaks
        if (word.includes('\n')) {
            const parts = word.split('\n');
            for (let i = 0; i < parts.length; i++) {
                if (i === 0) {
                    currentLine += parts[i];
                } else {
                    if (currentLine.trim()) {
                        textLines.push(currentLine.trim());
                    }
                    currentLine = parts[i];
                }
                if (i < parts.length - 1) {
                    if (currentLine.trim()) {
                        textLines.push(currentLine.trim());
                    }
                    currentLine = '';
                }
            }
        } else {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxLineWidth && currentLine) {
                textLines.push(currentLine.trim());
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
    }
    
    if (currentLine.trim() || currentText.endsWith(' ')) {
        textLines.push(currentLine);
    }
    
    // Trigger embedding update after delay
    lastUpdateTime = Date.now();
    if (!isUpdatingEmbedding && currentText.trim().length > 0) {
        setTimeout(updateEmbeddingAndVisualization, updateDelay);
    }
}

function renderText() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#c4bfbdff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set text properties
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = '#1e1e1eff';
    ctx.textBaseline = 'top';
    
    // Calculate starting position (centered)
    const totalHeight = Math.max(textLines.length, 1) * lineHeight;
    const startY = (canvas.height - totalHeight) / 2;
    
    // Get center position of user input
    const inputCenterX = canvas.width / 2;
    const inputCenterY = startY + (totalHeight / 2);
    
    // Render each line of user input
    textLines.forEach((line, index) => {
        const textWidth = ctx.measureText(line).width;
        const x = (canvas.width - textWidth) / 2;
        const y = startY + (index * lineHeight);
        
        ctx.fillText(line, x, y);
    });
    
    // Render blinking cursor
    const cursorVisible = Math.floor(Date.now() / 500) % 2;
    if (cursorVisible) {
        let cursorX, cursorY;
        
        if (textLines.length > 0) {
            const lastLine = textLines[textLines.length - 1];
            const textWidth = ctx.measureText(lastLine).width;
            cursorX = (canvas.width - textWidth) / 2 + textWidth;
            cursorY = startY + ((textLines.length - 1) * lineHeight);
        } else {
            cursorX = canvas.width / 2;
            cursorY = canvas.height / 2;
        }
        
        ctx.fillRect(cursorX + 2, cursorY, 2, fontSize);
    }
    
    // Draw visualization if available
    if (visualizationData && currentText.trim().length > 0) {
        drawEmbeddingVisualization(inputCenterX, inputCenterY);
    }
    
    // Show loading indicator if updating embedding
    if (isUpdatingEmbedding) {
        // Apply CSS filter to invert colors
        canvas.style.filter = 'invert(1)';

        // Radar animation
        const radarRadius = Math.min(canvas.width, canvas.height) / 4;
        const radarAngle = (Date.now() / 100) % (2 * Math.PI);
        ctx.strokeStyle = '#000000ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, radarRadius, radarAngle, radarAngle + Math.PI / 4);
        ctx.stroke();

        requestAnimationFrame(renderText); // Ensure animation updates
        return; // Skip rendering other elements during analysis
    } else {
        // Remove CSS filter when not analyzing
        canvas.style.filter = 'none';
    }
    
    // Request next frame for cursor animation
    requestAnimationFrame(renderText);
}

async function updateEmbeddingAndVisualization() {
    // Check if enough time has passed since last update
    if (Date.now() - lastUpdateTime < updateDelay) {
        return;
    }
    
    if (isUpdatingEmbedding || currentText.trim().length === 0) {
        return;
    }
    
    isUpdatingEmbedding = true;
    
    try {
        // Get embedding for current text
        const embedding = await getEmbedding(currentText.trim());
        
        if (embedding && meaningEmbeddings && meaningEmbeddings.length > 0) {
            // Get coordinates for top 5 similar embeddings
            const coordinates = await getCoordinates(embedding, meaningEmbeddings);
            visualizationData = coordinates;
        }
    } catch (error) {
        console.error('Error updating embedding:', error);
    } finally {
        isUpdatingEmbedding = false;
    }
}

function drawEmbeddingVisualization(centerX, centerY) {
    if (!visualizationData || !wordLs) return;
    
    const { topIndices, distances, angles } = visualizationData;
    
    // Scale factors for visualization
    if (firstTimeGetEmbedding){
        maxDistance = Math.max(...distances) || 1;
        firstTimeGetEmbedding = false;
    }
    
    //let maxDistance = Math.max(...distances) || 1;
    console.log(maxDistance);
    
    
    ctx.lineWidth = 1;
    ctx.font = '16px Inter, sans-serif';
    
    // Calculate the maximum possible distance from center to corner
    const maxPossibleDistance = Math.sqrt(centerX ** 2 + centerY ** 2)/3*2;

    topIndices.forEach((index, i) => {
        if (index >= wordLs.length) return;
        
        // Calculate position based on angle and distance
        const normalizedDistance = distances[i] / maxDistance;
        
        const x = centerX + Math.cos(angles[i]) * normalizedDistance * maxPossibleDistance;
        const y = centerY + Math.sin(angles[i]) * normalizedDistance * maxPossibleDistance;
        
        // Draw line from center to text
        if (normalizedDistance < 0.6){
            // make it into a dashed line
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#535353ff';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        
        
        // Draw connection point
        ctx.fillStyle = '#686868ff';
        ctx.beginPath();
        let size = (1-normalizedDistance)*20+4
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
        
        let textX = x + 50;
        let textY = y
        
        // Extract and display the complete meaning
        const meaningText = wordLs[index].replace(';', '\n');
    
        // Split into lines and format for display
        const lines = meaningText.split('\n').filter(line => line.trim() !== '');
        const word = lines[0]; // First line is the word
        const pronunciation = lines[1] || ''; // Second line is pronunciation
        const definition = lines.slice(2).join(' '); // Rest is definition
        
        // Create wrapped text for the definition
        const maxWidth = 200;
        const wordLine = word;
        const wrappedDefinition = wrapText(definition, maxWidth);
        const allLines = [word, pronunciation, ...wrappedDefinition];

        // Adjust text position dynamically based on line count
        const totalHeight = allLines.length * lineHeight;
        textY -= totalHeight / 2; // Center vertically

        // Render each line of text
        allLines.forEach((line, lineIndex) => {
            const y = textY + (lineIndex * lineHeight);
            if (lineIndex === 0) {
                ctx.font = 'bold 14px Inter, sans-serif'; // Make the first line bold
            } else {
                ctx.font = '14px Inter, sans-serif'; // Regular font for other lines
            }
            ctx.fillText(line, textX, y);
        });
        
        // Adjust text position to avoid overlap
        const angleOffset = (Math.PI / 6) * i; // Spread out text positions
        // textX += Math.cos(angles[i] + angleOffset) * 50;
        // textY += Math.sin(angles[i] + angleOffset) * 50;
        textX += 50;
        textY = y;
    });
    
    // Draw similarity scores
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(`Showing ${topIndices.length} similar meanings`, 20, canvas.height - 20);
}

async function getEmbedding(text){
    let url = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    let authToken = "";
    let version = "beautyyuyanli/multilingual-e5-large:a06276a89f1a902d5fc225a9ca32b6e8e6292b7f3b136518878da97c458e2bad";
    let data = {
        version: version,
        input:{
            texts: JSON.stringify([text]), // Properly format as JSON string array
            batch_size: 16,
            normalize_embeddings: false
        } 
    }

    let payload = {
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
    //console.log("json_response", json_response.output[0]);
    inputEmbedding = json_response.output[0];
    return json_response.output[0];
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

async function getCoordinates(center,embeddingsList) {
    // calculate all the cosine similarities
    let similarities = embeddingsList.map(emb => cosineSimilarity(center, emb));
    // get the top 5 most similar embeddings
    let topIndices = similarities
        .map((sim, idx) => ({sim, idx}))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5)
        .map(obj => obj.idx);

    // get the corresponding embeddings
    let topEmbeddings = topIndices.map(idx => embeddingsList[idx]);
    // append center vector to the list
    topEmbeddings.push(center);
    // perform PCA to reduce dimensions to 2D
    let eigenVectors = PCA.getEigenVectors(topEmbeddings);
    let reduced = PCA.computeAdjustedData(topEmbeddings, eigenVectors[0], eigenVectors[1]).adjustedData;
    //console.log('PCA reduced dimensions:', reduced);

    // transpose
    reduced= reduced[0].map((_, colIndex) => 
    reduced.map(row => row[colIndex])
    );

    let reducedCenter = reduced[reduced.length - 1];
    // create distance array as distance from the center
    let distances = reduced.slice(0, -1).map(vec => {
        return Math.sqrt((vec[0] - reducedCenter[0]) ** 2 + (vec[1] - reducedCenter[1]) ** 2);
    });
    let angles =  reduced.slice(0, -1).map(vec => Math.atan2(vec[1]-reducedCenter[1], vec[0]-reducedCenter[0]));
    console.log(distances);
    console.log(angles);
    console.log(topIndices);
    return {topIndices, distances, angles};
}

// Helper function to wrap text within a specified width
function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    ctx.font = '16px Inter, sans-serif'; // Set font for measuring
    
    for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}


