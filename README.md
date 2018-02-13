# YAMG
Yet another maps generator for O-A-D
----------------------------------------

This is a regular 'mod' for O-A-D. Drop it in your local folder and activate it in tool menu of O-A-D.
It contains a library split in two files:
	- fractal.js: contains all what is needed for fractal map generation, which can create full maps or work only on maps areas (Fractal Painter).
	- placers.js: contains various utilities to create roads, define regions and borders.
Both parts of the library are independant and can be used separately.

A random map script "Egyptian Oasis" is provided as well.

Upgrade note.
-------------
This version is for alpha-22, but can be easily upgraded to alpha-23.
	- of course, modifying the dependency in the 'mod.json' file.
	- The library itself don't call anything in rmgen, and work only with a proprietary tiles map.
A problem may arise when using the placers from a script written for alpha-23 (Not the Egyptian Oasis which don't call place() method). For now, the place() method of placers returns a PointXZ array, but through a convenience function located at the beginning of the 'placers.js' file.
See the README for full instructions.

The library and the Egyptian Oasis don't use any point object, and should upgrade nicely.

Have fun !

