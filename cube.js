const CORNERS = ["WRG", "WGO", "WOB", "WBR", "YGR", "YOG", "YBO", "YRB"];
const EDGES = ["WR", "WG", "WO", "WB", "YR", "YG", "YO", "YB", "GR", "GO", "BO", "BR"];
const MOVES = ["U1", "U2", "U3", "R1", "R2", "R3", "F1", "F2", "F3", "D1", "D2", "D3", "L1", "L2", "L3", "B1", "B2", "B3"];
const N_PERM_4 = 24;
const N_MOVE = 18;				// number of possible face moves
const N_TWIST = 2187;			// 3^7 possible corner orientations in phase 1
const N_FLIP = 2048;			// 2^11 possible edge orientations in phase 1
const N_UD_EDGES = 40320;       // 8! permutations of the edges in the U-face and D-face in phase 2
const SOLVED = 0;

function is_browser()
{
	try
	{
		return this===window;
	}
	catch(e)
	{
		return false;
	}
}

function load_buffer(url, key, bytes_per_value, cube)
{
	return new Promise(function(resolve, reject)
	{
		if (is_browser() == true)
		{
			var request = new XMLHttpRequest();
			request.responseType = 'arraybuffer';
			request.open('GET', url, true);
			request.setRequestHeader('Cache-Control', 'max-stale');
			request.onload = function() 
			{
				if (this.status == 200 || (this.status == 0 && this.response)) 
				{
					let array = null;
					if (bytes_per_value == 1)
					{
						array = new Uint8Array(this.response);
					}
					else if (bytes_per_value == 2)
					{
						array = new Uint16Array(this.response);
					}
					else if (bytes_per_value == 4)
					{
						array = new Uint32Array(this.response);
					}
					cube[key] = array;
					resolve(array);
				}
				reject();
			};
			request.send(null);
		}
		else
		{
			let fs = require('fs');
			let path = __dirname + "/" + url;
			let bytes = fs.readFileSync(path);
			let array = null;
			if (bytes_per_value == 1)
			{
				array = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
			}
			else if (bytes_per_value == 2)
			{
				array = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.length/2);
			}
			else if (bytes_per_value == 4)
			{
				array = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length/4);
			}
			cube[key] = array;
			resolve(array)
		}
	});
}

function Cube()
{
	// Represent a 3x3x3 cube by 
	// - its compontent movable pieces: 8 Corners, 12 Edges
	// - valid cube moves: 3 turns(Clockwise, Counterclocwise, & 180 degree rotation) * 6 faces (U, D, L, R, F, B)
	// adapted from https://github.com/hkociemba/RubiksCube-TwophaseSolver/blob/master/cubie.py

	// Initialize corners
	this.corner_permutations = []
	this.corner_orientations = []
	CORNERS.forEach((corner) => this.corner_permutations.push(corner));
	CORNERS.forEach(() => this.corner_orientations.push(0));
	// Initialize edges
	this.edge_permutations = [];
	this.edge_orientations = [];
	EDGES.forEach((edge) => this.edge_permutations.push(edge));
	EDGES.forEach(() => this.edge_orientations.push(0));

	// Map the corner positions to facelet positions in Spefz notation
	this.corner_face_map = [['C', 'M', 'J'], ['D', 'I', 'F'], ['A', 'E', 'R'], ['B', 'Q', 'N'],
							['V', 'K', 'P'], ['U', 'G', 'L'], ['X', 'S', 'H'], ['W', 'O', 'T']
							];

	// Map the edge positions to facelet positions.
	this.edge_face_map = [['B', 'M'], ['C', 'I'], ['D', 'E'], ['A', 'Q'], ['V', 'O'], ['U', 'K'],
						['X', 'G'], ['W', 'S'], ['J', 'P'], ['L', 'F'], ['R', 'H'], ['T', 'N']
						];

	// Load precalculated lookup tables from external files asynchronously. TODO: better caching
	this.load_promises = [];
	this.load_promises.push(load_buffer("twophase/fs_classidx", "flipslice_class_index", 2, this));
	this.load_promises.push(load_buffer("twophase/fs_sym", "flipslice_sym", 1, this));
	this.load_promises.push(load_buffer("twophase/phase1_prun", "flipslice_twist_depth3", 4, this));
	this.load_promises.push(load_buffer("twophase/conj_twist", "twist_conj", 2, this));
	this.load_promises.push(load_buffer("twophase/move_twist", "twist_move", 2, this));
	this.load_promises.push(load_buffer("twophase/move_flip", "flip_move", 2, this));
	this.load_promises.push(load_buffer("twophase/move_slice_sorted", "slice_sorted_move", 2, this));
	this.load_promises.push(load_buffer("twophase/move_corners", "corners_move", 2, this));
	this.load_promises.push(load_buffer("twophase/phase2_cornsliceprun", "corner_slice_depth", 1, this));
	this.load_promises.push(load_buffer("twophase/phase2_edgemerge", "u_edges_plus_d_edges_to_ud_edges", 2, this));
	this.load_promises.push(load_buffer("twophase/phase2_prun", "corners_ud_edges_depth3", 4, this));
	this.load_promises.push(load_buffer("twophase/co_classidx", "corner_class_index", 2, this));
	this.load_promises.push(load_buffer("twophase/co_sym", "corner_sym", 1, this));
	this.load_promises.push(load_buffer("twophase/conj_ud_edges", "ud_edges_conj", 2, this));
	this.load_promises.push(load_buffer("twophase/move_ud_edges", "ud_edges_move", 2, this));
	this.load_promises.push(load_buffer("twophase/move_u_edges", "u_edges_move", 2, this));
	this.load_promises.push(load_buffer("twophase/move_d_edges", "d_edges_move", 2, this));


	// array distance computes the new distance from the old_distance i and the new_distance_mod3 j.
	// We need this array because the pruning tables only store the distances mod 3.

	this.solutions = [];
	this.shortest_length = [999];
	this.prune_distance = [];
	for (let old_distance=0; old_distance<20; old_distance++)
	{
		for (let new_distance_mod3 = 0; new_distance_mod3<3; new_distance_mod3++)
		{
			let distance = Math.floor(old_distance / 3) * 3 + new_distance_mod3;
			if (old_distance % 3 == 2 && new_distance_mod3 == 0)
			{
				distance += 3;
			}
			else if (old_distance % 3 == 0 && new_distance_mod3 == 2)
			{
				distance -= 3;
			}
			this.prune_distance.push(distance);
		}
	}

	function get_random_integer(min, max) 
	{
		// Reterns a random integer within the range min-max
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function n_choose_k(n, k)
	{
		//Binomial coefficient (n choose k)
		if (n < k)
		{
			//console.log("n < k", n, k);
			return 0;
		}
		if (k > n / 2)
		{
			k = n - k;
		}
		let s = 1;
		let i = n;
		let j = 1;
		while (i != n - k)
		{
			s *= i;
			s = Math.floor(s / j)
			i -= 1
			j += 1
		}
		return s;
	}

	this.corner_multiply = function(other_cube)
	{
		// Multiply this Cube object with another cube, restricted to the corners. Does not change other_cube.
		let new_corner_orientations = [];
		let new_corner_permutations = [];
		let ori = 0;
		for (let corner_index in CORNERS)
		{
			new_corner_permutations.push(this.corner_permutations[other_cube.corner_permutations[corner_index]]);
			let ori_a = this.corner_orientations[other_cube.corner_permutations[corner_index]];
			let ori_b = other_cube.corner_orientations[corner_index];
			if (ori_a < 3 && ori_b < 3)  // two regular cubes
			{
				ori = ori_a + ori_b;
				if (ori >= 3)
				{
					ori -= 3;
				}
			}
			else if (ori_a < 3 <= ori_b)  // cube b is in a mirrored state
			{
				ori = ori_a + ori_b;
				if (ori >= 6)
				{
					ori -= 3;  // the composition also is in a mirrored state
				}
			}
			else if (ori_a >= 3 > ori_b)  // cube a is in a mirrored state
			{
				ori = ori_a - ori_b;
				if (ori < 3)
				{
					ori += 3;  // the composition is a mirrored cube
				}
			}
			else if (ori_a >= 3 && ori_b >= 3)  // if both cubes are in mirrored states
			{
				ori = ori_a - ori_b;
				if (ori < 0)
				{
					ori += 3;  // the composition is a regular cube
				}
			}
			new_corner_orientations.push(ori);
		}
		this.corner_permutations = new_corner_permutations;
		this.corner_orientations = new_corner_orientations;
	}

	this.edge_multiply = function(other_cube)
	{
		// Multiply this Cube object with another cube, restricted to the edges. Does not change other_cube.
		let new_edge_permutations = [];
		let new_edge_orientations = [];
		for (let edge_index in EDGES)
		{
			new_edge_permutations.push(this.edge_permutations[other_cube.edge_permutations[edge_index]]);
			new_edge_orientations.push((other_cube.edge_orientations[edge_index] + this.edge_orientations[other_cube.edge_orientations[edge_index]]) % 2);
		}
		this.edge_permutations = new_edge_permutations;
		this.edge_orientations = new_edge_orientations;
	}

	this.multiply = function(other_cube)
	{
		// Multiply this Cube object with another cube. Does not change other_cube.
		this.corner_multiply(other_cube);
		this.edge_multiply(other_cube);
	}

	this.corner_parity = function()
	{
		//Give the parity of the corner permutation.
		let num_swaps = 0;
		for (let corner_index = this.corner_permutations.length-1; corner_index >= 0; corner_index--)
		{
			for (let other_index = corner_index - 1; other_index >= 0; other_index--)
			{
				if (this.corner_permutations[other_index] > this.corner_permutations[corner_index])
				{
					num_swaps += 1;
				}
			}
		}
		return num_swaps % 2;
	}

	this.edge_parity = function()
	{
		//Give the parity of the edge permutation. A solvable cube has the same corner and edge parity.
		let num_swaps = 0
		for (let edge_index = this.edge_permutations.length-1; edge_index >= 0; edge_index--)
		{
			for (let other_index = edge_index - 1; other_index >= 0; other_index--)
			{
				if (this.edge_permutations[other_index] > this.edge_permutations[edge_index])
				{
					num_swaps += 1;
				}
			}
		}
		return num_swaps % 2;
	}

	this.to_string = function()
	{
		// Format cube state as readable string
		let output_string = "";
		for (let corner_index in this.corner_permutations)
		{
			output_string += '(' + this.corner_permutations[corner_index] + ',' + this.corner_orientations[corner_index] + ')';
		}
		output_string += '\n'
		for (let edge_index in this.edge_permutations)
		{
			output_string += '(' + this.edge_permutations[edge_index] + ',' + this.edge_orientations[edge_index] + ')';
		}
		return output_string
	}

	this.from_string = function(input_string)
	{
		// Parse cube state from input string
		let lines = input_string.split(/\r?\n/);
		let corners = lines[0].split(')');
		for (let corner_index in corners)
		{
			if (corner_index < this.corner_permutations.length)
			{
				let fields = corners[corner_index].slice(1).split(',');
				this.corner_permutations[corner_index] = fields[0];
				this.corner_orientations[corner_index] = parseInt(fields[1]);
			}
		}
		let edges = lines[1].split(')');
		for (let edge_index in edges)
		{
			if (edge_index < this.edge_permutations.length)
			{
				let fields = edges[edge_index].slice(1).split(',');
				this.edge_permutations[edge_index] = fields[0];
				this.edge_orientations[edge_index] = parseInt(fields[1]);
			}
		}
	}

	this.get_corner_faces = function()
	{
		// Gets the corners of the current cube state by color value at face position in Spefz notation
		let corner_faces = {};
		for (let corner_index in this.corner_permutations)
		{
			let current_permutation = this.corner_permutations[corner_index];
			let current_orientation = this.corner_orientations[corner_index];
			
			for (let twist_index = 0; twist_index < 3; twist_index++)
			{
				let face_letter = this.corner_face_map[corner_index][(twist_index + current_orientation)%3];
				corner_faces[face_letter] = current_permutation[twist_index];
			}
		}
		return corner_faces;
	}

	this.get_edge_faces = function()
	{
		// Gets the edges of the current cube state by color value at face position in Spefz notation
		let edge_faces = {};
		for (let edge_index in this.edge_permutations)
		{
			let current_permutation = this.edge_permutations[edge_index];
			let current_orientation = this.edge_orientations[edge_index];
			for (let flip_index = 0; flip_index < 2; flip_index++)
			{
				let face_letter = this.edge_face_map[edge_index][(flip_index + current_orientation)%2];
				edge_faces[face_letter] = current_permutation[flip_index];
			}
		}
		return edge_faces;
	}

	this.to_2d_string = function()
	{
		//Print cube state as readable string
		let corner_faces = this.get_corner_faces();
		let edge_faces = this.get_edge_faces();
		let output_string = "   " + corner_faces['A'] + edge_faces['A'] + corner_faces['B'] + "\n";
		output_string += "   " + edge_faces['D'] + "W" + edge_faces['B'] + "\n";
		output_string += "   " + corner_faces['D'] + edge_faces['C'] + corner_faces['C'] + "\n";
		output_string += corner_faces['E'] + edge_faces['E'] + corner_faces['F'] + corner_faces['I'] + edge_faces['I'] + corner_faces['J'] + corner_faces['M'] + edge_faces['M'] + corner_faces['N'] + corner_faces['Q'] + edge_faces['Q'] + corner_faces['R'] + "\n";
		output_string += edge_faces['H'] + "O" + edge_faces['F'] + edge_faces['L'] + "G" + edge_faces['J'] + edge_faces['P'] + "R" + edge_faces['N'] + edge_faces['T'] + "B" + edge_faces['S'] + "\n";
		output_string += corner_faces['H'] + edge_faces['G'] + corner_faces['G'] + corner_faces['L'] + edge_faces['K'] + corner_faces['K'] + corner_faces['P'] + edge_faces['O'] + corner_faces['O'] + corner_faces['T'] + edge_faces['S'] + corner_faces['S'] + "\n";
		output_string += "   " + corner_faces['U'] + edge_faces['U'] + corner_faces['V'] + "\n";
		output_string += "   " + edge_faces['X'] + "Y" + edge_faces['V'] + "\n";
		output_string += "   " + corner_faces['X'] + edge_faces['W'] + corner_faces['W'] + "\n";
		return output_string;
	}

	this.get_twist = function()
	{
		// Calculate and return the twist coodinate describing orientation of the 8 corners for phase 1.
		// Valid values range: 0 <= twist < 2187 (3^7)
		let twist = 0;
		for (let corner_index = 0; corner_index < this.corner_orientations.length-1; corner_index++)
		{
			twist = 3 * twist + this.corner_orientations[corner_index];
		}
		return twist;
	}

	this.set_twist = function(twist)
	{
		// Sets the orientations of the 8 corners according to the given twist coordinate value
		// Valid values range: 0 <= twist < 2187 (3^7)
		let twist_parity = 0
		for (let corner_index = this.corner_orientations.length - 2; corner_index >= 0; corner_index--)
		{
			this.corner_orientations[corner_index] = twist % 3;
			twist_parity += this.corner_orientations[corner_index]; 
			twist = Math.floor(twist/3);
		}
		// The orientation of the final corner is forced according to the number of twists in the first 7 corners
		this.corner_orientations[this.corner_orientations.length-1] = ((3 - twist_parity % 3) % 3);
	}

	this.get_flip = function()
	{
		// Calculate and return the flip coordinate describing the orientation of of the 12 edges for phase 1.
		// Valid values range: 0 <= flip < 2048 (2^11)
		let flip = 0;
		for (let edge_index = 0; edge_index < this.edge_orientations.length-1; edge_index++)
		{
			flip = 2 * flip + this.edge_orientations[edge_index];
		}
		return flip;
	}

	this.set_flip = function(flip)
	{
		// Sets the orientations of the 12 edges according to the given flip coordinate value
		// Valid values range: 0 <= flip < 2048 (2^11)
		let flip_parity = 0
		for (let edge_index = this.edge_orientations.length - 2; edge_index >= 0; edge_index--)
		{
			this.edge_orientations[edge_index] = flip % 2
			flip_parity += this.edge_orientations[edge_index];
			flip = Math.floor(flip/2);
		}
		// The orientation of the final edge is forced according to the number of flips in the first 11 edges
		this.edge_orientations[this.edge_orientations.length-1] = ((2 - flip_parity % 2) % 2)
	}

	this.get_slice = function()
	{
		// Calculate and return the location of the UD-slice edges FR,FL,BL and BR ignoring their permutation.
		//	0<= slice < 495 (12 choose 4 = 12!/(8!4!))
		let slice = 0;
		let edge_elements = 0;
		// Compute the index a < (12 choose 4)
//BR:11, UR:0
		for (let edge_index = this.edge_permutations.length - 1; edge_index >= 0; edge_index--)
		{
			let edge = this.edge_permutations[edge_index];
			if (edge[0] != 'W' && edge[0] != 'Y')
			{
				slice += n_choose_k(11 - edge_index, edge_elements + 1);
				edge_elements += 1;
			}
		}
		return slice;
	}

	this.set_slice = function(slice_index)
	{
		let slice_edges = EDGES.slice(8,12);
		let other_edge = EDGES.slice(0,8);
		let coordinate = slice_index;  // Location
		for (let edge_index in EDGES)
		{
			this.edge_permutations[edge_index] = -1;	//Reset all edges
		}
		let edge_elements = 4;  // set slice edges
		for (let edge_index in EDGES)
		{
			let binomial_coefficient = n_choose_k(11 - edge_index, edge_elements);
			if (coordinate - binomial_coefficient >= 0)
			{
				this.edge_permutations[edge_index] = slice_edges[4 - edge_elements];
				coordinate -= binomial_coefficient;
				edge_elements -= 1;
			}
		}

		edge_elements = 0  // set the remaining edges UR..DB
		for (let edge_index in EDGES)
		{
			if (this.edge_permutations[edge_index] == -1)
			{
				this.edge_permutations[edge_index] = other_edge[edge_elements];
				edge_elements += 1;
			}
		}
	}

	this.get_slice_sorted = function()
	{
		// Get the permutation and location of the UD-slice edges FR,FL,BL and BR.
		// 0 <= slice_sorted < 11880 in phase 1, 0 <= slice_sorted < 24 in phase 2, slice_sorted = 0 for solved cube.
		let slice_a = 0;
		let edge_elements = 0;
		let slice_edges = [];
		// First compute the index a < (12 choose 4) and the permutation array perm.
		for (let edge_index = this.edge_permutations.length - 1; edge_index >= 0; edge_index--)
		{
			let edge = this.edge_permutations[edge_index];
			if (edge[0] != 'W' && edge[0] != 'Y')
			{
				slice_a += n_choose_k(11 - edge_index, edge_elements + 1);
				slice_edges.unshift(edge);
				edge_elements += 1;
			}
		}
		// Then compute the index b < 4! for the permutation in edge4
		let slice_b = 0;
		for (let edge_index = slice_edges.length - 1; edge_index >= 0; edge_index--)
		{
			let num_rotations = 0;
			while (slice_edges[edge_index] != EDGES[edge_index + 8])
			{
				shift_array_backward(slice_edges, 0, edge_index);
				num_rotations += 1;
			}
			slice_b = (edge_index + 1)*slice_b + num_rotations;
		}
		return 24*slice_a + slice_b;
	}

	function shift_array_forward(array, begin_pos, end_pos)
	{
		//Shifts values in the array one position forward, from begin_pos to end_pos
		// with the value at end_pos cycling back to begin_pos
		let swap_buffer = array[end_pos];
		for (let index = end_pos; index >= begin_pos; index--)
		{
			array[index] = array[index-1];
		}
		array[begin_pos] = swap_buffer;
	}

	function shift_array_backward(array, begin_pos, end_pos)
	{
		//Shifts values in the array one position backward, from end_pos to begin_pos
		// with the value at begin_pos cycling back to end_pos
		let swap_buffer = array[begin_pos];
		for (let index = begin_pos; index <= end_pos; index++)
		{
			array[index] = array[index+1];
		}
		array[end_pos] = swap_buffer;
	}

	this.set_edges = function(permutation_index)
	{
		//Sets the permutation of the 12 edges according to permutation index
		this.edge_permutations = [];
		for (let edge_index in EDGES)
		{
			this.edge_permutations.push(EDGES[edge_index]);
		}
		for (let edge_index = 0; edge_index < EDGES.length; edge_index++)
		{
			for (let num_rotations = permutation_index % (edge_index + 1); num_rotations > 0; num_rotations--)
			{
				//Pretty sure this is not the most efficient way to do this,
				// but I want to make sure the state matches exactly the coordinate value
				// from the Kociemba implementation
				shift_array_forward(this.edge_permutations, 0, edge_index);
			}
			permutation_index = Math.floor(permutation_index / (edge_index + 1));
		}
	}

	this.get_edges = function()
	{
		//Gets the permutation index of the 12 edges according their positions
		let permutations = this.edge_permutations.map(edge => edge);
		let permutation_index = 0;
		for (let edge_index = this.edge_permutations.length - 1; edge_index >= 0; edge_index--)
		{
			let num_rotations = 0;
			while (permutations[edge_index] != EDGES[edge_index])
			{
				shift_array_backward(permutations, 0, edge_index);
				num_rotations += 1;
			}
			permutation_index = (edge_index + 1) * permutation_index + num_rotations;
		}
		return permutation_index;
	}

	this.get_u_edges = function()
	{
		//Get the permutation and location of edges UR, UF, UL and UB.
		//  0 <= u_edges < 11880 in phase 1, 0 <= u_edges < 1680 in phase 2, u_edges = 1656 for solved cube."""
		let edge_a = 0;
		let u_edge_index = 0;
		let u_edges = [];
		let permutations = this.edge_permutations.map(edge => edge);
		for (let rotation_index = 0; rotation_index < 4; rotation_index++)
		{
			shift_array_forward(permutations, 0, 11);
		}
		// First compute the index a < (12 choose 4) and the permutation array perm.
		for (let edge_index = permutations.length - 1; edge_index >= 0; edge_index--)
		{
			let edge = permutations[edge_index];
			if (edge[0] == 'W')
			{
				edge_a += n_choose_k(11 - edge_index, u_edge_index + 1);
				u_edges.unshift(edge);
				u_edge_index += 1;
			}
		}
		// Then compute the index b < 4! for the permutation in edge4
		let edge_b = 0;
		for (let edge_index = 3; edge_index >= 0; edge_index--)
		{
			let num_rotations = 0;
			while (u_edges[edge_index] != EDGES[edge_index])
			{
				shift_array_backward(u_edges, 0, edge_index);
				num_rotations += 1;
			}
			edge_b = (edge_index + 1)*edge_b + num_rotations;
		}
		return 24*edge_a + edge_b;
	}

	this.get_d_edges = function()
	{
		//Get the permutation and location of edges DR, DF, DL and DB.
		//  0 <= d_edges < 11880 in phase 1, 0 <= d_edges < 1680 in phase 2, d_edges = 1656 for solved cube."""
		let edge_a = 0;
		let d_edge_index = 0;
		let d_edges = [];
		let permutations = this.edge_permutations.map(edge => edge);
		for (let rotation_index = 0; rotation_index < 4; rotation_index++)
		{
			shift_array_forward(permutations, 0, 11);
		}
		// First compute the index a < (12 choose 4) and the permutation array perm.
		for (let edge_index = permutations.length - 1; edge_index >= 0; edge_index--)
		{
			let edge = permutations[edge_index];
			if (edge[0] == 'Y')
			{
				edge_a += n_choose_k(11 - edge_index, d_edge_index + 1);
				d_edges.unshift(edge);
				d_edge_index += 1;
			}
		}
		// Then compute the index b < 4! for the permutation in edge4
		let edge_b = 0;
		for (let edge_index = 3; edge_index >= 0; edge_index--)
		{
			let num_rotations = 0;
			while (d_edges[edge_index] != EDGES[edge_index+4])
			{
				shift_array_backward(d_edges, 0, edge_index);
				num_rotations += 1;
			}
			edge_b = (edge_index + 1)*edge_b + num_rotations;
		}
		return 24*edge_a + edge_b;
	}

	this.get_corners = function()
	{
		//Get the permutation of the 8 corners.  0 <= corners < 40320
		let permutations = this.corner_permutations.map(corner => corner);
		let permutation_index = 0;
		for (let corner_index = this.corner_permutations.length - 1; corner_index >= 0; corner_index--)
		{
			let num_rotations = 0;
			while (permutations[corner_index] != CORNERS[corner_index])
			{
				shift_array_backward(permutations, 0, corner_index);
				num_rotations += 1;
			}
			permutation_index = (corner_index + 1) * permutation_index + num_rotations;
		}
		return permutation_index;
	}

	this.set_corners = function(permutation_index)
	{
		//Sets the permutation of the 8 corners.  0 <= corners < 40320
		this.corner_permutations = []
		for (let corner_index in CORNERS)
		{
			this.corner_permutations.push(CORNERS[corner_index]);
		}
		for (let corner_index = 0; corner_index < this.corner_permutations.length; corner_index++)
		{
			for (let num_rotations = permutation_index % (corner_index + 1); num_rotations > 0; num_rotations--)
			{
				shift_array_forward(this.corner_permutations, 0, corner_index);
			}
			permutation_index = Math.floor(permutation_index / (corner_index + 1));
		}
	}

	this.scramble = function()
	{
		//Generate a randomly scrabmled. The probability is the same for all possible states.
		let random_state = [get_random_integer(0,479001600),	// 12! edge permutations
							get_random_integer(0,40320),		// 8! corner permutations
							get_random_integer(0,2048),			// 2^11 edge orientations
							get_random_integer(0,2187)			// 3^7 corner orientations
							];
		this.set_edges(random_state[0])  // 12!
		let edge_parity = this.edge_parity();
		this.set_corners(random_state[1]);  // 8!
		let corner_parity = this.corner_parity();  // parities of edge and corner permutations must be the same
		while (edge_parity != corner_parity)
		{
			random_state[1] = get_random_integer(0,40320);
			this.set_corners(random_state[1]);  // 8!
			corner_parity = this.corner_parity();  // parities of edge and corner permutations must be the same
		}
		this.set_flip(random_state[2])  // 2^11
		this.set_twist(random_state[3])  // 3^7
		return random_state;
	}

	this.verify = function()
	{
		//Check if cube is valid.
		// "Laws of the cube" from: https://www.speedsolving.com/wiki/index.php?title=Laws_of_the_cube
		// 1. Only an even number of cubie swaps is possible (1/2 of all permutations)
		// 2. Only an even number of edges can be in a flipped state (1/2 of all edge orientations)
		// 3. The total number of corner twists must be divisible by 3 (1/3 of all corner orientations) 

		// Look for missing pieces
		if (this.edge_permutations.length < 12)
		{
			console.log("Invalid cube: missing edges");
			return false;
		}
		if (this.corner_permutations.length < 8)
		{
			console.log("Invalid cube: missing corners");
			return false;
		}

		// Check Law 2: Only an even number of edges can be in a flipped state
		let edge_flips = 0;
		for (let edge_index = 0; edge_index < this.edge_orientations.length; edge_index++)
		{
			edge_flips += this.edge_orientations[edge_index];
		}
		if (edge_flips % 2 != 0)
		{
			console.log("Invalid cube: odd number of edge flips", edge_flips);
			return false;
		}

		// Check Law 3: The total number of corner twists must be divisible by 3
		let corner_twists = 0;
		for (let corner_index = 0; corner_index < this.corner_orientations.length; corner_index++)
		{
			corner_twists += this.corner_orientations[corner_index];
		}
		if (corner_twists % 3 != 0)
		{
			console.log("Invalid cube: number of corner twists not divisble by 3");
			return false;
		}

		// Check Law 1: Only an even number of cubie swaps is possible.
		//  An odd number of edge swaps is only possible if there is also an odd number of corner swaps
		if (this.edge_parity() != this.corner_parity())
		{
			console.log("edge_parity != corner_parity");
			return false;
		}

		return true;
	}

	this.get_flipslice_twist_depth3 = function(index)
	{
		//Returns *exactly* the number of moves % 3 to solve phase 1 of a cube with given index
		let y = this.flipslice_twist_depth3[Math.floor(index / 16)];
		y >>= (index % 16) * 2;
		return y & 3;
	}

	this.get_corners_ud_edges_depth3 = function(index)
	{
		//Returns *at least* the number of moves % 3 to solve phase 2 of a cube with given index
		let y = this.corners_ud_edges_depth3[Math.floor(index / 16)];
		y >>= (index % 16) * 2;
		return y & 3;
	}

	this.get_depth_phase1 = function()
	{
		// Compute and retrun the distance to the cube subgroup H where flip=slice=twist=0
		let slice = Math.floor(this.get_slice_sorted() / N_PERM_4);
		let flip = this.get_flip();
		let twist = this.get_twist();
		let flipslice = N_FLIP * slice + flip;
		let classidx = this.flipslice_class_index[flipslice];
		let sym = this.flipslice_sym[flipslice];
		let depth_mod3 = this.get_flipslice_twist_depth3(N_TWIST * classidx + this.twist_conj[(twist << 4) + sym]);

		//console.log(slice, flip, twist, flipslice, classidx, sym, depth_mod3);
		let depth = 0;
		while (flip != 0 || slice != 0 || twist != 0)
		{
			if (depth_mod3 == 0)
			{
				depth_mod3 = 3;
			}
			for (let move_index = 0; move_index < MOVES.length; move_index++)
			{
				let new_twist = this.twist_move[N_MOVE * twist + move_index];
				let new_flip = this.flip_move[N_MOVE * flip + move_index];
				let new_slice = Math.floor(this.slice_sorted_move[N_MOVE * slice * N_PERM_4 + move_index] / N_PERM_4);
				let new_flipslice = N_FLIP * new_slice + new_flip;
				let new_classidx = this.flipslice_class_index[new_flipslice];
				let new_sym = this.flipslice_sym[new_flipslice];
				let depth_after_move = this.get_flipslice_twist_depth3(N_TWIST * new_classidx + this.twist_conj[(new_twist << 4) + new_sym])
				//console.log(move_index, new_slice, new_flip, new_twist, new_flipslice, new_classidx, new_sym, depth_after_move, depth_mod3);
				if (depth_after_move == depth_mod3 - 1)
				{
					depth += 1;
					twist = new_twist;
					flip = new_flip;
					slice = new_slice;
					depth_mod3 -= 1;
					break;
				}
			}
		}
		return depth;
	}

	this.get_depth_phase2 = function(corners, ud_edges)
	{
		//Get distance to subgroup where only the UD-slice edges may be permuted in their slice (only 24/2 = 12 possible
		//ways due to overall even parity). This is a lower bound for the number of moves to solve phase 2.
		let classidx = this.corner_class_index[corners];
		let sym = this.corner_sym[corners];
		//let ud_edges_shift_4 = ud_edges << 4;
		//let ud_edges_conj = this.ud_edges_conj[(ud_edges << 4) + sym];
		let depth_mod3 = this.get_corners_ud_edges_depth3(N_UD_EDGES * classidx + this.ud_edges_conj[(ud_edges << 4) + sym]);
		if (depth_mod3 == 3)  // unfilled entry, depth >= 11
		{
			return 11;
		}
		let depth = 0;
		while (corners != SOLVED || ud_edges != SOLVED)
		{
			if (depth_mod3 == 0)
			{
				depth_mod3 = 3;
			}
			// only iterate phase 2 moves
			for (let move_index = 0; move_index < MOVES.length; move_index++)
			{
				let move = MOVES[move_index];
				if (move[0] == 'U' || move[0] == 'D' || move[1] == '2')	//U1, U2, U3, R2, F2, D1, D2, D3, L2, B2
				{
					let new_corners = this.corners_move[N_MOVE * corners + move_index];
					let new_ud_edges = this.ud_edges_move[N_MOVE * ud_edges + move_index];
					let new_classidx = this.corner_class_index[new_corners];
					let sym = this.corner_sym[new_corners];
					let new_depth = this.get_corners_ud_edges_depth3(N_UD_EDGES * new_classidx + this.ud_edges_conj[(new_ud_edges << 4) + sym])
					//console.log("phase2 move", move, new_corners, ud_edges1, classidx1, sym, new_depth);
					if (new_depth == depth_mod3 - 1)
					{
						depth += 1;
						corners = new_corners;
						ud_edges = new_ud_edges;
						depth_mod3 -= 1;
						break;
					}
				}
			}
		}
		return depth;
	}

	this.search = function(flip, twist, slice_sorted, dist, togo_phase1)
	{
		if (this.phase2_done)  // solution already found
		{
			return;
		}
		if (togo_phase1 == 0)  // phase 1 solved
		{
			// compute initial phase 2 coordinates
			let last_move_index = 0;
			let last_move = MOVES[0];
			if (this.sofar_phase1)  // check if list is not empty
			{
				last_move_index = this.sofar_phase1[this.sofar_phase1.length-1];
				last_move = MOVES[last_move_index];
			}

			let corners = 0;
			if (last_move[1] == "3" && last_move != "U" && last_move != "D") //[Move.R3, Move.F3, Move.L3, Move.B3]  # phase 1 solution come in pairs
			{
				corners = this.corners_move[18 * this.cornersave + last_move_index - 1];  // apply R2, F2, L2 ord B2 on last ph1 solution
			}
			else
			{
				corners = this.get_corners();
				for (let phase1_index in this.sofar_phase1)  // get current corner configuration
				{
					let phase1_move = this.sofar_phase1[phase1_index];
					corners = this.corners_move[18 * corners + phase1_move];
				}
				this.cornersave = corners;
			}

			// new solution must be shorter and we do not use phase 2 maneuvers with length > 11 - 1 = 10
			let togo2_limit = Math.min(this.shortest_length[0] - this.sofar_phase1.length, 11)
			if (this.corner_slice_depth[24 * corners + slice_sorted] >= togo2_limit)  // precheck speeds up the computation
			{
				return;
			}

			let u_edges = this.get_u_edges();
			let d_edges = this.get_d_edges();
			for (let sofar_index = 0; sofar_index < this.sofar_phase1.length; sofar_index++)
			{
				let move_index = this.sofar_phase1[sofar_index];
				u_edges = this.u_edges_move[18 * u_edges + move_index];
				d_edges = this.d_edges_move[18 * d_edges + move_index];
			}
			let ud_edges = this.u_edges_plus_d_edges_to_ud_edges[24 * u_edges + d_edges % 24];

			let dist2 = this.get_depth_phase2(corners, ud_edges);
			for (let togo2 = dist2; togo2 < togo2_limit; togo2++)  // do not use more than togo2_limit - 1 moves in phase 2
			{
				this.sofar_phase2 = [];
				this.phase2_done = false;
				this.search_phase2(corners, ud_edges, slice_sorted, dist2, togo2);
				if (this.phase2_done)  // solution already found
				{
					break;
				}
			}
		}
		else
		{
			for (let move_index = 0; move_index < MOVES.length; move_index++)
			{
				// dist = 0 means that we are already are in the subgroup H. If there are less than 5 moves left
				// this forces all remaining moves to be phase 2 moves. So we can forbid these at the end of phase 1
				// and generate these moves in phase 2.
				if (dist == 0 && togo_phase1 < 5)
				{
					let move = MOVES[move_index];
					if (move[0] == 'U' || move[0] == 'D' || move[1] == '2')
					{
						continue;
					}
				}

				if (this.sofar_phase1.length > 0)
				{
					let diff = Math.floor(this.sofar_phase1[-1] / 3) - Math.floor(move_index / 3);
					if (diff == 0 || diff == 3)  // successive moves: on same face or on same axis with wrong order
					{
						continue;
					}
				}

				let flip_new = this.flip_move[18 * flip + move_index];  // N_MOVE = 18
				let twist_new = this.twist_move[18 * twist + move_index];
				let slice_sorted_new = this.slice_sorted_move[18 * slice_sorted + move_index];

				let flipslice = 2048 * Math.floor(slice_sorted_new / 24) + flip_new  // N_FLIP * (slice_sorted // N_PERM_4) + flip
				let classidx = this.flipslice_class_index[flipslice];
				let sym = this.flipslice_sym[flipslice];
				let dist_new_mod3 = this.get_flipslice_twist_depth3(2187 * classidx + this.twist_conj[(twist_new << 4) + sym]);
				let dist_new = this.prune_distance[3 * dist + dist_new_mod3];
				if (dist_new >= togo_phase1)  // impossible to reach subgroup H in togo_phase1 - 1 moves
				{
					continue;
				}

				this.sofar_phase1.push(move_index);
				this.search(flip_new, twist_new, slice_sorted_new, dist_new, togo_phase1 - 1);
				this.sofar_phase1.pop();
			}
		}
	}

	this.search_phase2 = function(corners, ud_edges, slice_sorted, dist, togo_phase2)
	{
		if (togo_phase2 == 0 && slice_sorted == 0)
		{
			//self.lock.acquire()  # phase 2 solved, store solution
			let sofar = this.sofar_phase1.concat(this.sofar_phase2);
			//console.log("phase1:", this.sofar_phase1, "phase2:", this.sofar_phase2);
			if (this.solutions.length == 0 || this.solutions[this.solutions.length-1].length > sofar.length)
			{
				/*
				if self.inv == 1:  # we solved the inverse cube
					man = list(reversed(man))
					man[:] = [Move((m // 3) * 3 + (2 - m % 3)) for m in man]  # R1->R3, R2->R2, R3->R1 etc.
				let solution = [];
				for (let move_index = 0; move_index < sofar.length; move_index++)
				{
					solution.append(MOVES[this.conj_move[N_MOVE * 16 * this.rot + move_index]]);
				}
				*/
				this.solutions.push(sofar);
				this.shortest_length[0] = sofar.length
			}

			//if self.shortest_length[0] <= self.ret_length:  # we have reached the target length
			//	self.terminated.set()
			//self.lock.release()
			this.phase2_done = true
		}
		else
		{
			for (let move_index = 0; move_index < MOVES.length; move_index++)
			{
				let move = MOVES[move_index];
				if (move[0] == 'U' || move[0] == 'D' || move[1] == '2')	//U1, U2, U3, R2, F2, D1, D2, D3, L2, B2
				{

					if (this.sofar_phase2.length > 0)
					{
						let last_move = this.sofar_phase2[this.sofar_phase2.length-1];
						let diff = Math.floor(last_move / 3) - Math.floor(move_index / 3);
						if (diff == 0 || diff == 3)  // successive moves: on same face or on same axis with wrong order
						{
							continue;
						}
					}
					else
					{
						if (this.sofar_phase1.length > 0)
						{
							let diff = Math.floor(this.sofar_phase1[this.sofar_phase1.length-1] / 3) - Math.floor(move_index / 3);
							if (diff == 0 || diff == 3)  // successive moves: on same face or on same axis with wrong order
							{
								continue;
							}
						}
					}

					let corners_new = this.corners_move[18 * corners + move_index];
					let ud_edges_new = this.ud_edges_move[18 * ud_edges + move_index];
					let slice_sorted_new = this.slice_sorted_move[18 * slice_sorted + move_index];

					let classidx = this.corner_class_index[corners_new];
					let sym = this.corner_sym[corners_new];
					let dist_new_mod3 = this.get_corners_ud_edges_depth3(40320 * classidx + this.ud_edges_conj[(ud_edges_new << 4) + sym]);
					let dist_new = this.prune_distance[3 * dist + dist_new_mod3];
					let corner_slice_depth = this.corner_slice_depth[24 * corners_new + slice_sorted_new];
					//console.log("phase2 add", move, "dist", dist_new, "corner slice depth", corner_slice_depth, "togo", togo_phase2, "corners", corners_new, "slice_sorted", slice_sorted_new, slice_sorted);
					if (Math.max(dist_new, corner_slice_depth) >= togo_phase2)
					{
						continue  // impossible to reach solved cube in togo_phase2 - 1 moves
					}

					this.sofar_phase2.push(move_index)
					this.search_phase2(corners_new, ud_edges_new, slice_sorted_new, dist_new, togo_phase2 - 1)
					this.sofar_phase2.pop()
				}
			}
		}
	}

	this.call_when_ready = async function(callback)
	{
		let resolve_count = 0;
		for (let promise_index = 0; promise_index < this.load_promises.length; promise_index++)
		{
			this.load_promises[promise_index].then(() => 
			{
				resolve_count++; 
				if (resolve_count >= this.load_promises.length)
				{
					callback();
				}
			});
		}
	}

	this.reset_state = function()
	{
		CORNERS.forEach((corner) => this.corner_permutations.push(corner));
		CORNERS.forEach(() => this.corner_orientations.push(0));
		EDGES.forEach((edge) => this.edge_permutations.push(edge));
		EDGES.forEach(() => this.edge_orientations.push(0));
	}

	this.reset_solutions = function()
	{
		this.solutions = [];
		this.shortest_length = [999];
		this.phase2_done = false;
	}

	this.solve = function()
	{
		this.reset_solutions();
		// TODO Use symmetry & inversion to divide & conquer search on multiple threads
		/*
		if (rotation == 1) // conjugation by 120° rotation
		{
			solve_cube = Cube(sy.symCube[32].cp, sy.symCube[32].co, sy.symCube[32].ep, sy.symCube[32].eo)
			solve_cube.multiply(this);
			solve_cube.multiply(sy.symCube[16])
		}
		else if (rotation == 2)  // conjugation by 240° rotation
		{
			solve_cube = Cube(sy.symCube[16].cp, sy.symCube[16].co, sy.symCube[16].ep, sy.symCube[16].eo)
			solve_cube.multiply(this)
			solve_cube.multiply(sy.symCube[32])
		}
		if (inversion == 1)  // invert cube
		{
			solve_cube = Cube();
			solve_cube.invert(this);
		}
		*/

		let distance = this.get_depth_phase1();
		for (let current_distance = distance; current_distance < 20; current_distance++) // iterative deepening, solution has at least dist moves
		{
			this.sofar_phase1 = [];
			this.search(this.get_flip(), this.get_twist(), this.get_slice_sorted(), distance, current_distance);
		}
		return this.solutions[this.solutions.length-1];
	}

	this.solve_async = async function()
	{
		let cube = this;
		//await cube.wait_until_ready();
		this.solve_promise = new Promise( function(resolve) 
		{
			cube.call_when_ready(function ()
			{
				let solution = cube.solve();
				resolve(solution);
			});
		});
		return this.solve_promise;
	}

	this.reverse_solution = function(solution)
	{
		let scramble_string = "";
		for (let move_index = solution.length-1; move_index >= 0; move_index--)
		{
			if (scramble_string != "")
			{
				scramble_string += " ";
			}
			let move = MOVES[solution[move_index]];
			if (move[1] == '3')
			{
				move = move[0];
			}
			if (move[1] == '1')
			{
				move = move[0] + "'";
			}
			scramble_string += move;
		}
		return scramble_string;
	}

	this.generate_scramble = function()
	{
		let cube = this;
		// Step 1. Generate random cube state
		let random_state = this.scramble();
		let cube_as_string = this.to_string();
		/*
		console.log(random_state);
		console.log(this.to_string());
		console.log(this.to_2d_string());
		*/
		// Step 2. Solve from generated random state
		let solution = this.solve();
		// Step 3. Reverse the moves of the solution to get back to scrabled state
		let scramble_string = cube.reverse_solution(solution);
		return [scramble_string, cube_as_string, random_state];
	}

}

if (typeof module !== 'undefined')
{
	module.exports = Cube;
}
//var cube = new Cube();
//let [scramble, state] = cube.generate_scramble();
//console.log(scramble);
//console.log(state);

