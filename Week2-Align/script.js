// DOM elements
let canvas;
let ctx;
let uploadButton;
let fileInput;

// sketchRNN classes setup
let draw_class = null;
 const classes = ["alarm_clock", "ambulance", "angel", "ant", "antyoga",
        "backpack", "barn", "basket", "bear", "bee",
        "beeflower", "bicycle", "bird", "book", "brain",
        "bridge", "bulldozer", "bus", "butterfly", "cactus",
        "calendar", "castle", "cat", "catbus", "catpig",
        "chair", "couch", "crab", "crabchair", "crabrabbitfacepig",
        "cruise_ship", "diving_board", "dog", "dogbunny", "dolphin",
        "duck", "elephant", "elephantpig", "eye", "face",
        "fan", "fire_hydrant", "firetruck", "flamingo", "flower",
        "floweryoga", "frog", "frogsofa", "garden", "hand",
        "hedgeberry", "hedgehog", "helicopter", "kangaroo", "key",
        "lantern", "lighthouse", "lion", "lionsheep", "lobster",
        "map", "mermaid", "monapassport", "monkey", "mosquito",
        "octopus", "owl", "paintbrush", "palm_tree", "parrot",
        "passport", "peas", "penguin", "pig", "pigsheep",
        "pineapple", "pool", "postcard", "power_outlet", "rabbit",
        "rabbitturtle", "radio", "radioface", "rain", "rhinoceros",
        "rifle", "roller_coaster", "sandwich", "scorpion", "sea_turtle",
        "sheep", "skull", "snail", "snowflake", "speedboat",
        "spider", "squirrel", "steak", "stove", "strawberry",
        "swan", "swing_set", "the_mona_lisa", "tiger", "toothbrush",
        "toothpaste", "tractor", "trombone", "truck", "whale",
        "windmill", "yoga", "yogabicycle"];

// sketchPad
let strokes = []; // stores the sequence of [dx, dy, pen_down, pen_up, pen_end]
let lastX = 0;
let lastY = 0;
let drawing = false;

// sketchRNN model
let model;
let rnn_state;



init();

function initInterface(){
    let buttonBlockOffset = 100;
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.setAttribute('id','canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight-buttonBlockOffset;
    canvas.style.position = "absolute";
    canvas.style.left = "50%";
    canvas.style.transform = "translateX(-50%)";
    canvas.style.top = "0";

    ctx = canvas.getContext('2d');
    ctx.fillStyle = "#3f6f75";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    uploadButton = document.createElement('button');
    uploadButton.innerText = 'Upload Image';
    document.body.appendChild(uploadButton);
    uploadButton.style.display = "block";          
    uploadButton.style.margin = "20px auto";      
    uploadButton.style.padding = "10px 20px";      
    uploadButton.style.fontSize = "16px";
    uploadButton.style.position = "absolute";
    uploadButton.style.top = canvas.height + "px";
    uploadButton.style.left = "50%";
    uploadButton.style.transform = "translateX(-50%)";
    uploadButton.style.cursor = "pointer";
    
    // hidden file input
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Button click triggers file input
    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });

    //Handle file selection
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // fill the canvas with the image
        const img = new Image();
        img.onload = function() {
            const canvasRatio = canvas.width / canvas.height;
            const imgRatio = img.width / img.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgRatio > canvasRatio) {
                // image is wider than canvas, crop width
                drawHeight = canvas.height;
                drawWidth = img.width * (canvas.height / img.height);
                offsetX = (canvas.width - drawWidth) / 2;
                offsetY = 0;
            } else {
                // image is taller than canvas, crop height
                drawWidth = canvas.width;
                drawHeight = img.height * (canvas.width / img.width);
                offsetX = 0;
                offsetY = (canvas.height - drawHeight) / 2;
            }

            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // after drawing image, call VLM for getting class label (needs to be called in the image.onload)
            getClass().then(async () => {
                // after getting the class, initialize the model
                await initModel(draw_class);
            });
        };
        img.src = URL.createObjectURL(file);
    });
}

function init(){
    initInterface();
    initSketchPad();
}

function animate(){
    
}


async function getClass(){
    const url = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    let authToken = "";
    // force specifying reason for CoT prompting
    let prompt = "Given the following image, choose a class from the following classes that the one might draw in the center of this image. Please only respond with the following format: {\"class_name\": \"class\",\"reason\": \"reason(concisely, in less then 2 sentences)\"}";
    prompt += "\nClasses: " + classes.join(", ") + ".";
    // let prompt = "describe whats in the image concisely, less than 3 sentences."
    let data = {        
        model: "openai/gpt-4o-mini",
        input: {
            prompt: prompt,
            systemPrompt : "You are a helpful assistant that helps people find the right class for their drawing based on the context of the image provided.",
            image_input: [canvas.toDataURL()], // base64 without the prefix
            top_p:1,
            temperature:0.8,
            //max_completion_tokens:20
        },
    }
    console.log("Making a Fetch Request");
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
    //turn it into json
    const json_response = await raw_response.json();
    //console.log("json_response", json_response);
    draw_class =  JSON.parse(json_response.output.join(""))["class_name"];
    console.log("setting drawing class to", draw_class);
}

// TODO
function initSketchPad(){
    // pen state format  [dx, dy, pen_down, pen_up, pen_end]
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    canvas.addEventListener('mousedown',(e)=>{
        strokes = [];
        if(model){
            rnn_state = model.zeroState(); // reset RNN state for new drawing
        }
        drawing = true;
        lastX = e.offsetX;
        lastY = e.offsetY;
    
        // Start of a new stroke
        strokes.push([0, 0, 1, 0, 0]); // pen_down
    })

    canvas.addEventListener('mousemove',(e)=>{
        if(!drawing) return;
        
        const dx = e.offsetX - lastX;
        const dy = e.offsetY - lastY;
        strokes.push([dx, dy, 1, 0, 0]); // pen_down

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();

        lastX = e.offsetX;
        lastY = e.offsetY;
    })

    // end the sketch if the mouse is released or leaves the canvas
    canvas.addEventListener('mouseup',(e)=>{
        if(!drawing) return;
        endUserDrawing();
    })
    canvas.addEventListener('mouseleave',(e)=>{
        if(!drawing) return;
        endUserDrawing();
    })
}

function endUserDrawing(){
    drawing = false;
    //strokes.push([0, 0, 0, 0, 1]);
    //console.log(strokes) 
    updateModelStates();
    predictNextStroke();
}

function predictNextStroke(){
    if(!model || !rnn_state) return;

    const pdf = model.getPDF(rnn_state,0.1);
    const [dx, dy, ...newPen] = model.sample(pdf);
    console.log("Next stroke:", [dx, dy, ...newPen]);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(lastX+dx, lastY+dy);
    ctx.stroke();
    lastX += dx;
    lastY += dy;

    rnn_state = model.update([dx, dy, ...newPen], rnn_state);
    if (newPen[2] !== 1) {
      // not end of drawing, keep predicting
      requestAnimationFrame(predictNextStroke);
    }

}

async function initModel(class_name){
    if (!class_name) {
        console.error("No class name provided for model initialization.");
        return;
    }
    let model_path = `https://storage.googleapis.com/quickdraw-models/sketchRNN/models/${class_name}.gen.json`
    model = new ms.SketchRNN(model_path);
    console.log("Loading model with class:", class_name);
    
    // Wait for the model to finish loading before initializing state
    await model.initialize();
    rnn_state = model.zeroState(); // set state to zero state after model is loaded
    console.log("Model loaded and state initialized");
    return model;
}

async function updateModelStates(){
    if(!model || !rnn_state || strokes.length === 0){
        console.log("Model not ready, RNN state not initialized, or no strokes");
        return;
    }
    
    // Convert strokes array to proper tensor format
    console.log("Strokes length:", strokes.length);
    console.log("Sample stroke:", strokes[0]);
    
    for(let i=0; i<strokes.length; i++){
        if(strokes[i].length === 5) {
            rnn_state = model.update(strokes[i], rnn_state);
        } else {
            console.error("Invalid stroke format:", strokes[i]);
        }
    }
}