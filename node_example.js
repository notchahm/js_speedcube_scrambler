const scrambler = require('js_speedcube_scrambler');

// Initialize a new scrambler object
let cube = new scrambler();

// Generate a random cube state and also generate moves to reach scrambled state
let [scramble, string, coordinates] = cube.generate_scramble();

// Output the scramble moves to console
console.log(scramble);

// Visualize the cube state as an unfolded view of the cube faces by sticker color
console.log(cube.to_2d_string());
