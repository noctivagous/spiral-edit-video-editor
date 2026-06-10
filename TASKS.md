

[ ] lines extend perpendicular to the timeline with 
time markers around the rectangular spiral (matching
the zoom level) so that there is information about time.

[X]  implement a zoom line when the z key is pressed once
and the second press of the z key ends the drag.

[ ] play modes 
put a toggle switch for the two playback modes
playback: [playhead | strip]
(existing, but with label) timeline: [frames | clips]
a. playhead  - stationary frames.
playhead and playhead line travel, not frames
i. playhead begins at center of spiral and
playhead and line travel outwards.
ii. playhead begins at end of spiral and travels
inwards.
b. strip - moving frames current: frames travel inwards,
playhead is stationary at center.


[ ] marker layers
a. beginning and ending of clip lines perpendicular
to the timeline line extend above and below.
b. 

[ ] key bindings manager

remap zoom line to v key
z - animated zoom in at point
x - animated zoom out at point


[ ] selection and cut/copy/paste of video clips
  [ ] clips should be selectable with the mouse key or f key acting as mouse 
  click at mouse location
  [ ] the playhead should be movable by left mouse click or
  the d key which moves the playhead to the mouse cursor location.
  [ ] 
  
  
FUTURE:

- ffmpeg wasm
- add clip to clip library and it is stored in indexdb
	- operations modal: crop, speed change, etc.
- drag clip to timeline


