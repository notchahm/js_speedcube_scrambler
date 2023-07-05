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
All of the basic functionality is available through a single import of ``cube.js``.

For frontend web applications, the simplest way to use it is importing via HTML ``<script src="cube.js">`` tag. See ``index.html`` as a working example of how it can be integrated into a web page.

For backend web applications, simply ``require('cube');`` within a node.js script to import it as a module. See ``cube.test.js`` as an example.

The future plan is to make this project available as an npm package. Until then, installation is a manual process of copying the source files to your project.

## Contributing
I'm a fan of both the coding community and the cubing community. Collaboration is welcome, just reach out to me through GitHub.
