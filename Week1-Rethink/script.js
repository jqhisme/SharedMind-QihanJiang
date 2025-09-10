// Get the input box and the canvas element
const canvas = document.createElement('canvas');
canvas.setAttribute('id', 'myCanvas');
canvas.style.position = 'absolute';
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.left = '0';
canvas.style.top = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
document.body.appendChild(canvas);
console.log('canvas', canvas.width, canvas.height);


const inputBox = document.createElement('input');
inputBox.setAttribute('type', 'text');
inputBox.setAttribute('id', 'inputBox');
inputBox.setAttribute('placeholder', 'Enter text here');
inputBox.style.position = 'absolute';
inputBox.style.left = '200px';
inputBox.style.top = '200px';
inputBox.style.transform = 'translate(-50%, -50%)';
inputBox.style.zIndex = '100';
inputBox.style.fontSize = '30px';
inputBox.style.fontFamily = 'Arial';
document.body.appendChild(inputBox);

// Add event listener to the input box
inputBox.addEventListener('keydown', function (event) {
    // Check if the Enter key is pressed
    if (event.key === 'Enter') {
        const inputValue = inputBox.value;
        const ctx = canvas.getContext('2d');
        ctx.font = '30px Arial';
        const inputBoxRect = inputBox.getBoundingClientRect();
        const x = inputBoxRect.left;
        const y = inputBoxRect.top;
        ctx.fillStyle = 'black';
        ctx.fillText(inputValue, x, y);
        inputBox.value = '';
        // inputBox.value = '';
        // let randomX = Math.floor(Math.random() * window.innerWidth);
        // let randomY = Math.floor(Math.random() * window.innerHeight);
        // inputBox.style.top = randomY + 'px';
        // inputBox.style.left = randomX + 'px';
    }
});

canvas.addEventListener("mousedown",(event)=>{
    inputBox.style.left = event.clientX + 'px';
    inputBox.style.top = event.clientY + 'px';
})


// Sine wave animation for input box
let startTime = null;
let deltaX = 2;
let deltaY = 2;

function animateInputBox(time) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;
    inputBox.style.left = parseFloat(inputBox.style.left) + deltaX + 'px';
    inputBox.style.top = parseFloat(inputBox.style.top) + deltaY + 'px';

    // if the input box hits the edge of the window, reverse direction
    const inputBoxRect = inputBox.getBoundingClientRect();
    if (inputBoxRect.right >= window.innerWidth || inputBoxRect.left <= 0) {
        deltaX = -deltaX //+ (Math.random() * 10 - 1); // add a bit of randomness
    }
    if (inputBoxRect.bottom >= window.innerHeight || inputBoxRect.top <= 0) {
        deltaY = -deltaY //+ (Math.random() * 10 - 1); // add a bit of randomness
    }
    requestAnimationFrame(animateInputBox);
}
requestAnimationFrame(animateInputBox);

