import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set, push, onChildAdded, onChildChanged, onChildRemoved, get } from "https://www.gstatic.com/firebasejs/12.3.0//firebase-database.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// Initialize Firebase
let app;
let db;

// variables
const question = "You are talking to a friend in a bar.\n You have finished 2 drinks \nand you talked for a long time about something you regret. \nYour friend suddenly got carried away, \nsaying in a high tone -\n'But you cannot travel back in time!', \nand you say:";
let top2 = null;
let mean = null;
let pcaSampleSize = 10;

// canvas
let canvas;
let ctx;

let allText = []; // array to store all text data showing on canvas
let allPositions = {}; // object to store all positions of the text

// for firebase db
let folder = "ConnectiveStatements/";

initFirebase();
createCanvas();
getBaseProjectionMatrix().then(() => {
    console.log("Projection matrix ready");
});

function initFirebase(){
    const firebaseConfig = {
        apiKey: "AIzaSyBCYQr6M-mmKG-eAIVjMg7zbEY0UE_aYag",
        authDomain: "sharedmindsf25.firebaseapp.com",
        projectId: "sharedmindsf25",
        storageBucket: "sharedmindsf25.firebasestorage.app",
        messagingSenderId: "591865195209",
        appId: "1:591865195209:web:91d8ed111fcea070fafb18",
        measurementId: "G-ZZBCFZVSBN"
    };
    app = initializeApp(firebaseConfig);
    db = getDatabase();
    window.db = db;


    onChildAdded(ref(db, folder), (data) => {
        const entry = data.val();
        if (!entry || !entry.text || !entry.embedding) {
            console.warn(`Invalid entry added:`, entry);
            return;
        }

        // Project the embedding to 2D
        const pos = projectTo2D(entry.embedding);
        const x = (pos[0] + 0.1) / 0.2 * canvas.width * 0.5;
        const y = (pos[1] + 0.1) / 0.2 * canvas.height * 0.5;

        // Store the position and text locally
        allText.push(entry.text);
        allPositions[entry.text] = { x, y };

        // Draw the text and point on the canvas
        drawText(entry.text, x, y);

        console.log(`Added entry:`, entry.text, { x, y });
    });
    onChildChanged(ref(db, folder), (data) => {
        console.log("changed", data.key, data.val());
    });
    onChildRemoved(ref(db, folder), (data) => {
        console.log("removed", data.key, data.val());
    });
}
async function getBaseProjectionMatrix() {
    const dbRef = ref(db, folder);

    // Check if there are more than 5 entries in the database
    const snapshot = await get(dbRef);
    let embeddings;

    if (snapshot.exists()) {
        const data = snapshot.val();
        const entries = Object.values(data);

        if (entries.length > 5) {
            console.log("Using existing entries from the database."); // only get the number of generatedSampleSize entries
            // I rewrite my code. Right now the embeddings is an array in the entry, so just calculate a PCA based on all these embeddings

            // instead of slicing the first 10, we can randomly sample 10 from the entries
            // shuffle the entries array
            for (let i = entries.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [entries[i], entries[j]] = [entries[j], entries[i]];
            }
            embeddings = entries.slice(0, pcaSampleSize).map(entry => entry.embedding);
            allText.push(...entries.slice(0, pcaSampleSize).map(entry => entry.text));
            
            
        } else {
            console.log("Not enough entries in the database. Generating new responses.");
            // fack back on generating 5 entries
            const responses = await Promise.all(Array.from({ length: 5 }, () => generateText(question)));
            embeddings = await Promise.all(responses.map(response => getEmbedding(response)));
            allText.push(...responses);
        }
    } else {
        console.log("Database is empty. Generating new responses.");
        const responses = await Promise.all(Array.from({ length: 5 }, () => generateText(question)));
        embeddings = await Promise.all(responses.map(response => getEmbedding(response)));
        allText.push(...responses);
    }
    console.log(allText);
    console.log(embeddings);
    

    // Perform PCA on the embeddings to get the projection matrix
    let eigen = PCA.getEigenVectors(embeddings);
    top2 = [eigen[0].vector, eigen[1].vector];
    mean = meanVector(embeddings);

    for (let i = 0; i < allText.length; i++) {
        const pos = projectTo2D(embeddings[i]);
        const x = (pos[0] + 0.1) / 0.2 * canvas.width*0.5;
        const y = (pos[1] + 0.1) / 0.2 * canvas.height*0.5;
        allPositions[allText[i]] = { x, y };
    }
    drawExsitingData(allText, allPositions);
}

function drawExsitingData(textArr, posObj) {
    textArr.forEach((text) => {
        const pos = posObj[text];
        if (!pos) {
            console.warn(`Position for text '${text}' is missing. Skipping.`);
            return;
        }

        // Draw the text and point on the canvas
        drawText(text, pos.x, pos.y);

        // Draw lines to the three closest points
        if (textArr.length > 1) {
            // Calculate distances to all other points
            let distances = textArr.map(otherText => {
                if (otherText === text) return { text: otherText, dist: Infinity }; // Ignore self
                const otherPos = posObj[otherText];
                if (!otherPos) {
                    console.warn(`Position for other text '${otherText}' is missing. Skipping.`);
                    return null;
                }
                const dist = Math.hypot(otherPos.x - pos.x, otherPos.y - pos.y);
                return { text: otherText, dist };
            }).filter(Boolean); // Remove null entries

            // Sort by distance and take the three closest
            distances.sort((a, b) => a.dist - b.dist);
            const closest = distances.slice(0, 3);

            closest.forEach(({ text: otherText }) => {
                const otherPos = posObj[otherText];
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(otherPos.x, otherPos.y);
                ctx.strokeStyle = 'rgb(107, 117, 140)';
                ctx.stroke();
            });
        }
    });
}
// helper function to compute mean vector
function meanVector(data) {
    const n = data.length;
    const d = data[0].length;
    const mean = Array(d).fill(0);
    data.forEach(row => {
        for (let i = 0; i < d; i++) mean[i] += row[i];
    });
    return mean.map(v => v / n);
}

function projectTo2D(theEmbedding){
    let centered = theEmbedding.map((v, i) => v - mean[i]);

    // project onto 2D plane
    let x = top2[0].reduce((sum, v, i) => sum + v * centered[i], 0);
    let y = top2[1].reduce((sum, v, i) => sum + v * centered[i], 0);

    return [x, y];
}

async function generateText(prompt){
    let url = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    let authToken = "";
    let model = "openai/gpt-4o-mini";
    let data = {
        model: model,
        input:{
              "top_p": 0.9,
                "prompt": `Finish the sentence by mimicking people: ${prompt}, please only return the rest of the sentence without any other explanation and punctuations.`,
                "messages": [],
                "image_input": [],
                "temperature": 0.9,
                "system_prompt": "Mimic people and finish the sentence in a humorous and dynamic way.",
                "presence_penalty": 0,
                "frequency_penalty": 0,
                "max_completion_tokens": 256
        }
    }
    let payload = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: 'application/json',
        }
        , body: JSON.stringify(data),
    }; 
    const raw_response = await fetch(url, payload);
    const json_response = await raw_response.json();
    console.log(json_response.output.join(" "));
    return json_response.output.join(" ");
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
    let inputEmbedding = json_response.output[0];
    console.log(inputEmbedding);
    return inputEmbedding;
}

// Create and initialize the canvas
function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = 'rgb(0, 45, 150)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render the question
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgb(255, 255, 255)'; // Question color
    const lines = question.split('\n');
    const lineHeight = 30; // Adjust line height as needed
    const startY = canvas.height * 0.25 - (lines.length * lineHeight) / 2;

    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type here and press Enter';
    input.style.position = 'absolute';
    input.style.left = `${canvas.width / 2 - 150}px`;
    input.style.top = `${canvas.height * 0.75}px`;
    input.style.width = '300px';
    input.style.backgroundColor = 'rgb(28, 28, 28)';
    input.style.color = 'rgb(107, 117, 140)';
    input.style.border = '1px solid rgb(150, 150, 150)';
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    document.body.appendChild(input);

    input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            const text = input.value.trim();
            if (text) {
                const embedding = await getEmbedding(text);
                const coords = projectTo2D(embedding);
                console.log('Coordinates:', coords);

                // Map the coord from -0.1 to 0.1 to canvas size
                const x = (coords[0] + 0.1) / 0.2 * canvas.width * 0.5;
                const y = (coords[1] + 0.1) / 0.2 * canvas.height * 0.5;
                console.log('Mapped coordinates:', { x, y });

                // Draw the point on the canvas
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgb(150, 150, 150)'; // Dot color
                ctx.fill();

                // Also draw the text next to the point
                ctx.font = '16px Arial';
                ctx.fillStyle = 'rgb(150, 150, 150)'; // Text color
                ctx.fillText(text, x + 10, y - 10);
                input.value = '';

                console.log('Finished drawing point and text');

                // write to firebase
                writeData(text, embedding);

                // push to the allText array and allPositions object
                allText.push(text);
                allPositions[text] = { x, y };

                // connect the point to three closest points
                if (allText.length > 1) {
                    // calculate distances to all other points
                    let distances = allText.map(otherText => {
                        if (otherText === text) return { text: otherText, dist: Infinity }; // ignore self
                        const pos = allPositions[otherText];
                        const dist = Math.hypot(pos.x - x, pos.y - y);
                        return { text: otherText, dist };
                    });

                    // sort by distance and take the three closest
                    distances.sort((a, b) => a.dist - b.dist);
                    const closest = distances.slice(0, 3);
                    closest.forEach(({ text: otherText }) => {
                        const pos = allPositions[otherText];
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(pos.x, pos.y);
                        ctx.strokeStyle = 'rgb(150, 150, 150)'; // Line color
                        ctx.stroke();
                    });
                }
                
            }
        }
    });
}

function writeData(inputText,embedding){
    // sanity check
    if (!Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error("Expected an array of length 1024");
    }
    let data = { text: inputText, embedding: embedding };
    const dbRef = ref(db, folder + '/')
    push(dbRef, data);
}

function drawText(text, x,y){
    ctx.font = '16px Arial';
    ctx.fillText(text, x + 10, y - 10);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgb(150, 150, 150)';
    ctx.fill();
}

