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
    let test_cases = {
		0:0,
		40844549:1,
		53616634:2,
		74699800:2,
		133371309:1, 
		134318026:1, 
		133425987:1, 
		134158367:0,
		123708508:0,
		433775:0
	};

	for (let test_case of Object.entries(test_cases))
	{
        let coordinate_value = test_case[0];
        let expected_result = test_case[1];
        let test_result = test_cube.get_flipslice_twist_depth3(coordinate_value);
		expect(test_result).toBe(expected_result);
    }
});
test('test phase2 depth', () => 
{
    let test_cases = {
		0:0,
		6895130:0,
		9838584:0,
		161286:1,
		76677226:1,
		6653225:2,
		15931546:2,
		548926:3,
		45845056:3,
		99703002:3,
		101872814:3,
	};

	for (let test_case of Object.entries(test_cases))
	{
        let coordinate_value = test_case[0];
        let expected_result = test_case[1];
        let test_result = test_cube.get_corners_ud_edges_depth3(coordinate_value);
		expect(test_result).toBe(expected_result);
    }
});

test('test solve', () => 
{
	//let test_cases = {[403807629,33462,833,770]:"D2 F2 R2 B2 R2 U F2 D' L2 D' B L' B R' U' F' D' F L2 B U'"};
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
    }
});

