const Cube = require('./cube');

var test_cube = new Cube();

test('test twist', () => 
{
	let test_coordinates = [0, 1093, 2186];
	test_coordinates.forEach( coordinate =>
	{
		test_cube.set_twist(coordinate);
		expect(test_cube.get_twist()).toBe(coordinate);
		expect(test_cube.verify()).toBe(true);
	});
});

test('test flip', () => 
{
	let test_coordinates = [0, 63, 2047];
	test_coordinates.forEach( coordinate =>
	{
		test_cube.set_flip(coordinate);
		expect(test_cube.get_flip()).toBe(coordinate);
		expect(test_cube.verify()).toBe(true);
	});
});

test('test slice', () => 
{
	let test_coordinates = [0, 123, 494];
	test_coordinates.forEach( coordinate =>
	{
		test_cube.set_slice(coordinate);
		expect(test_cube.get_slice()).toBe(coordinate);
		expect(test_cube.verify()).toBe(true);
	});
});

test('test corners', () => 
{
	let test_coordinates = [0, 33462, 40319];
	test_cube.reset_state();
	test_coordinates.forEach( coordinate =>
	{
		test_cube.set_corners(coordinate);
		expect(test_cube.get_corners()).toBe(coordinate);
		//expect(test_cube.verify()).toBe(true);
	});
});

test('test edges', () => 
{
	let test_coordinates = [0, 403807629, 479001599];
	test_cube.reset_state();
	test_coordinates.forEach( coordinate =>
	{
		test_cube.set_edges(coordinate);
		expect(test_cube.get_edges()).toBe(coordinate);
		//expect(test_cube.verify()).toBe(true);
	});
});

test('test phase1 depth', () => 
{
	let test_cases = [
		[[0,0,0],0],
		[[447,1966,271],0],
		[[1598,145,394],0],
		[[816,149,81],0],
		[[2014,392,412],0],
		[[1500,1774,289],1],
		[[2156,1472,278],1],
		[[276,277,137],1],
		[[869,1169,79],1],
		[[1230,1902,437],2],
		[[2153,1424,289],2],
		[[293,277,169],2],
		[[465,1169,377],2],
	];

	for (let test_case of test_cases)
	{
		let coordinate_values = test_case[0];
		let expected_result = test_case[1];
		let test_result = test_cube.get_flip_slice_twist_depth3(coordinate_values[0], coordinate_values[1], coordinate_values[2]);
		expect(test_result).toBe(expected_result);
	}
});

test('test phase2 depth', () => 
{
	let test_cases = [
		[[0,0],0],
		[[392,3648],0],
		[[1675,10382],0],
		[[40300,32790],0],
		[[157,313],1],
		[[18949,25586],1],
		[[35504,39864],1],
		[[565,234],2],
		[[6248,13688],2],
		[[30644,20673],2],
	];

	for (let test_case of test_cases)
	{
		let coordinate_values = test_case[0];
		let expected_result = test_case[1];
		let test_result = test_cube.get_corners_ud_edges_depth3(coordinate_values[0], coordinate_values[1]);
		expect(test_result).toBe(expected_result);
	}
});

test('test solve', () => 
{
	let test_cases = {
		"D2 F2 R2 B2 R2 U F2 D' L2 D' B L' B R' U' F' D' F L2 B U'":[403807629,33462,833,770],
		"B2 R2 B2 U B2 R2 D' F2 U2 B2 F' U' F' U2 L U' B F2 U F'":[70595234,38284,1087,273],
		"D F2 U R2 U R2 F2 L2 U' F' U' B' F' L F2 D' F L2 D' U2":[279118853,34959,1021,592],
	};
	for (let test_case of Object.entries(test_cases))
	{
		let target_scramble = test_case[0];
		let state_coords = test_case[1];
		test_cube.set_edges(state_coords[0]);
		test_cube.set_corners(state_coords[1]);
		test_cube.set_flip(state_coords[2]);
		test_cube.set_twist(state_coords[3]);

		let solution = test_cube.solve();
		let test_result = test_cube.reverse_solution(solution);
		expect(test_result).toBe(target_scramble);
		for (let move_index = 0; move_index < solution.length; move_index++)
		{
			let move = test_cube.get_move_string_from_index(solution[move_index]);
			if (move[1] == '3')
			{
				move = move[0] + "'";
			}
			else if (move[1] == "1")
			{
				move = move[0];
			}
			test_cube.apply_move(move);
		}
		expect(test_cube.get_edges()).toBe(0);
		expect(test_cube.get_corners()).toBe(0);
	}
});

