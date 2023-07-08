//const scrambler = require('js_speedcube_scrambler');
const scrambler = require('./cube');

// Initialize a new scrambler object
let cube = new scrambler();

// Generate a random cube state and also generate moves to reach scrambled state
let [scramble, string, coordinates] = cube.generate_scramble();

// Output the scramble moves to console
console.log(scramble);

// Visualize the cube state as an unfolded view of the cube faces by sticker color
console.log(cube.to_2d_string());


let moves = scramble.split(' ');
for (let move_index = moves.length-1; move_index >= 0; move_index--)
{
	let move = moves[move_index];
	if (move.length == 1)
	{
		move += "'";
	}
	else if (move[1] == "'")
	{
		move = move[0];
	}
	cube.apply_move(move);
}
console.log(cube.to_2d_string());

