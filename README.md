# js_speedcube_scrambler

## Overview
A module to generate directions for random scramble states for the 3x3 Rubik's cube.

The code is largely based on Herbert Kociemba's open python implementation of his
two phase algorithm for fast solving of the 3x3 Rubik's cube found here
[TwophaseSolver](https://github.com/hkociemba/RubiksCube-TwophaseSolver/tree/master)

This project aims to
- Make it easier to integrate an efficient solver into a web application, such as a scramble generator
- Have a single implementation that works for both front-end javascript and back-end nodejs
- Establish a basis to work on potential improvements upon the existing codebase
- Make the code and algorithms easier to understand

## Using
This javascript module can be used either by importing into a web page or running as a backend application through node.js.
Installation of the module is availabe through npm by executing the command ``npm i js_speedcube_scrambler``
All of the basic functionality is available through a single import

For frontend web applications, the simplest way to use it is importing via HTML ``<script src="cube.js">`` tag. See ``index.html`` as a working example of how it can be integrated into a web page.

For backend web applications, simply ``require('js_speedcube_scrambler');`` within a node.js script to import it as a module. See ``node_example.js`` as an example.


A functional demo of a webpage with a simple 3x3 scramble generator is available [here](https://notchahm.github.io/js_speedcube_scrambler/)

## Roadmap
- "Light" version that, sacrifice some processing speed & movecount to do more algorithmic solutions for domino reduction instead of relying on big lookup tables
- Animated 3D cube representation via WebGL to visualize moves to execute scramble for beginners unfamiliar with notation
- C++ webassembly implementation
- Other puzzles (other NxN, Skewb, etc)

## Contributing
I'm a fan of both the coding community and the cubing community. Collaboration is welcome, just reach out to me (notchahm) through GitHub.
