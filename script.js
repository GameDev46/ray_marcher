/*

 _____                         ______                 ___   ____ 
|  __ \                        |  _  \               /   | / ___|
| |  \/  __ _  _ __ ___    ___ | | | |  ___ __   __ / /| |/ /___ 
| | __  / _` || '_ ` _ \  / _ \| | | | / _ \\ \ / // /_| || ___ \
| |_\ \| (_| || | | | | ||  __/| |/ / |  __/ \ V / \___  || \_/ |
 \____/ \__,_||_| |_| |_| \___||___/   \___|  \_/      |_/\_____/


*/

/* 
	AUTHOR: GameDev46

	Youtube: https://www.youtube.com/@gamedev46
	Github: https://github.com/GameDev46
*/

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;

document.addEventListener('pointerlockchange', lockChangeAlert, false);
document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

canvas.onclick = function() {
	canvas.requestPointerLock();
}

let pixelSize = 10;

let gameobjects = [];

let worldLights = [];

let worldAmbience = 0.3;

let maxBounces = 8;

let lightWorld = true;

let slowRender = false;
let stillRendering = true;
let renderPosHolder = [0, 0];

let currentScene = 3;
let scenesCount = 3;

let camera = {
	x: 0,
	y: 0,
	z: 0,
	xRot: Math.PI,
	yRot: 0,
	zRot: 0,
	moveSpeed: 100,
	sensitivity: 0.01,
	deltaTime: 0,
	fov: 90
}

window.addEventListener("resize", e => {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	renderViewport();
})

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function drawPixel(x, y, colour) {
	ctx.fillStyle = rgbToHex(Math.round(colour.r * 255), Math.round(colour.g * 255), Math.round(colour.b * 255))
	ctx.fillRect(x, y, pixelSize, pixelSize);
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// position, radius, colour, position, type, data

function addNewGameObject(objectData) {
	gameobjects.push(objectData)
	return gameobjects.length - 1;
}

function rgb(red, green, blue) {
	return [red / 255, green / 255, blue / 255]
}

function createNewWorldLight(position, brightness, colour, range) {
	worldLights.push([position, 0, brightness, colour, position, range])
	return worldLights.length - 1;
}

function setAmbience(ambience) {
	worldAmbience = ambience;
}

function getPixelColour(x, y, totalCamRotation) {
	let currentPos = { x: camera.x, y: camera.y, z: camera.z }

	let cameraFOVCalc = {
		x: ((window.innerWidth / 2) - x) / ((window.innerWidth / 2) / degToRad(camera.fov / 2)),
		y: ((window.innerHeight / 2) - y) / ((window.innerWidth / 2) / degToRad(camera.fov / 2))
	}

	let calcDir = [Math.sin(camera.yRot + cameraFOVCalc.x), Math.sin(camera.xRot + cameraFOVCalc.y), Math.cos(camera.yRot + cameraFOVCalc.x)]

	let div = totalCamRotation;

	let dist = [0, 0];

	let savedColours = [];
	let savedColour = [0, 0, 0];

	let savedReflectivity = [];
	let bounces = 0;
	let savedReflectionPos = { x: camera.x, y: camera.y, z: camera.z };

	while (dist[1] < 12000 && getDistance(camera, currentPos) < 25000) {
		dist = getLargestSafeDistance(currentPos.x, currentPos.y, currentPos.z);

		if (dist[1] < 0.1) {

			// Check if object is reflective

			if (bounces < maxBounces) {
				// Reflect ray

				if (bounces == 0) {
					// Save start object position for shadows

					savedReflectionPos = {
						x: currentPos.x,
						y: currentPos.y,
						z: currentPos.z
					}

				}

				let hitObjectColour = lightPixel(currentPos, dist[0].colour, x / pixelSize, y / pixelSize);

				hitObjectColour.r = lerp(hitObjectColour.r, dist[0].colour[0], 0.7);
				hitObjectColour.g = lerp(hitObjectColour.g, dist[0].colour[1], 0.7);
				hitObjectColour.b = lerp(hitObjectColour.b, dist[0].colour[2], 0.7);

				savedColours.push([hitObjectColour.r, hitObjectColour.g, hitObjectColour.b]);
				savedReflectivity.push(dist[0].reflectivity);

				bounces += 1;

				// Calculate normal - NEED TO IMPLEMENT

				let normal = [0, 0, 0];

				if (dist[0].model == "box") {
					// Flat upward facing surface
					normal = [dist[0].normal[0], dist[0].normal[1], dist[0].normal[2]];
				}

				if (dist[0].model == "sphere") {
					// Flat upward facing surface
					normal = [1, 1, -1]

					let pointAwayFromSurface = {
						x: (currentPos.x - dist[0].position.x) / dist[0].scale.r,
						y: (currentPos.y - dist[0].position.y) / dist[0].scale.r,
						z: (currentPos.z - dist[0].position.z) / dist[0].scale.r
					}

					normal = [pointAwayFromSurface.x, pointAwayFromSurface.y, pointAwayFromSurface.z]
				}

				// Alter normals for diffuse lighting

				normal[0] *= lerp(noise(currentPos.x * currentPos.z, currentPos.y / currentPos.z), 1, dist[0].smoothness)
				normal[1] *= lerp(noise(currentPos.x / currentPos.z, currentPos.y * currentPos.y), 1, dist[0].smoothness)
				normal[2] *= lerp(noise(currentPos.x * currentPos.x * currentPos.y, currentPos.y * 29328), 1, dist[0].smoothness)

				// Multiply direction by normal vector

				calcDir[0] *= normal[0];
				calcDir[1] *= normal[1];
				calcDir[2] *= normal[2];

				// Shift position out of object

				let exitDist = 0.2;

				currentPos.x += (exitDist * calcDir[0]) / div;
				currentPos.y += (exitDist * calcDir[1]) / div;
				currentPos.z += (exitDist * calcDir[2]) / div;

			}
			else {

				// No more reflections - ready to render pixel

				if (bounces == 0) {
					// No reflection

					savedColour = dist[0].colour;
				}
				else {
					// Combine all reflections

					let lastObjectColour = lightPixel(currentPos, dist[0].colour, x / pixelSize, y / pixelSize);

					savedColour = [lastObjectColour.r, lastObjectColour.g, lastObjectColour.b];

					// Loop backward through all hit surfaces and compile a final colour
					for (let i = savedColours.length - 1; i >= 0; i--) {

						savedColour[0] = lerp(savedColours[i][0], savedColour[0], savedReflectivity[i]);
						savedColour[1] = lerp(savedColours[i][1], savedColour[1], savedReflectivity[i]);
						savedColour[2] = lerp(savedColours[i][2], savedColour[2], savedReflectivity[i]);

					}

					currentPos = savedReflectionPos;

				}

				// Get the colour of the pixel based on lighting
				let lightingData = lightPixel(currentPos, savedColour, x / pixelSize, y / pixelSize);

				// Mix the shadows depending in the objects reflectivity
				if (bounces != 0) {
					lightingData.r = lerp(lightingData.r, savedColour[0], savedReflectivity[0]);
					lightingData.g = lerp(lightingData.g, savedColour[1], savedReflectivity[0]);
					lightingData.b = lerp(lightingData.b, savedColour[2], savedReflectivity[0]);
				}

				// Return the colour of the pixel
				return lightingData;
			}
		}

		currentPos.x += (dist[1] * calcDir[0]) / div;
		currentPos.y += (dist[1] * calcDir[1]) / div;
		currentPos.z += (dist[1] * calcDir[2]) / div;
	}

	if (bounces > 0) {
		// Return mixed colour from reflection

		// Combine all reflections
		savedColour = [0.45, 0.45, 0.8];

		// Loop backward through all hit surfaces and compile a final colour
		for (let i = savedColours.length - 1; i >= 0; i--) {

			savedColour[0] = lerp(savedColours[i][0], savedColour[0], savedReflectivity[i]);
			savedColour[1] = lerp(savedColours[i][1], savedColour[1], savedReflectivity[i]);
			savedColour[2] = lerp(savedColours[i][2], savedColour[2], savedReflectivity[i]);

		}

		// Get the colour of the pixel based on lighting
		let lightingData = lightPixel(savedReflectionPos, savedColour, x / pixelSize, y / pixelSize);

		// Mix the shadows depending in the objects reflectivity
		if (bounces != 0) {
			lightingData.r = lerp(lightingData.r, savedColour[0], savedReflectivity[0]);
			lightingData.g = lerp(lightingData.g, savedColour[1], savedReflectivity[0]);
			lightingData.b = lerp(lightingData.b, savedColour[2], savedReflectivity[0]);
		}

		return lightingData;

	}

	// return sky colour as no object found
	return { r: 0.45, g: 0.45, b: 0.8 };
}

function noise(x, y) {
	let XmodVal = 94721;
	let YmodVal = 293782;

	let max = XmodVal * YmodVal;

	let hash = (((x + 3748734737) ^ 2) % XmodVal) * (((y - 17216233) ^ 3) % YmodVal)
	hash = hash / max;

	return hash;
}

function getLargestSafeDistance(x, y, z) {
	let smallestDistance = Infinity;

	let closestGameObject = null;

	for (let i = 0; i < gameobjects.length; i++) {

		if (gameobjects[i].model == "sphere") {
			if (getDistance(gameobjects[i].position, { x: x, y: y, z: z }) - gameobjects[i].scale.r < smallestDistance) {
				smallestDistance = getDistance(gameobjects[i].position, { x: x, y: y, z: z }) - gameobjects[i].scale.r;

				closestGameObject = gameobjects[i];
			}

		}
		else if (gameobjects[i].model == "box") {
			if (getDistanceFromSquare({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles) < smallestDistance) {
				smallestDistance = getDistanceFromSquare({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles)

				closestGameObject = gameobjects[i];
			}
		}
		else if (gameobjects[i].model == "boxHole") {
			if (distFromCubeWithSphereHole({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles) < smallestDistance) {
				smallestDistance = distFromCubeWithSphereHole({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles)

				closestGameObject = gameobjects[i];
			}
		}
		else if (gameobjects[i].model == "flatSphere") {
			if (distFromSphereWithFlatSides({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles) < smallestDistance) {
				smallestDistance = distFromSphereWithFlatSides({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles)

				closestGameObject = gameobjects[i];
			}
		}
		else if (gameobjects[i].model == "gyroid") {
			if (getDistanceFromGyroid({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles) < smallestDistance) {
				smallestDistance = getDistanceFromGyroid({ x: x, y: y, z: z }, gameobjects[i].position, gameobjects[i].scale, gameobjects[i].bump, gameobjects[i].tiles)

				closestGameObject = gameobjects[i];
			}
		}

	}

	return [closestGameObject, smallestDistance];
}

function getDistance(position1, position2) {

	let posDif = { x: position2.x - position1.x, y: position2.y - position1.y, z: position2.z - position1.z }

	let distance2d = (posDif.x * posDif.x) + (posDif.y * posDif.y)

	let distance3d = Math.sqrt(distance2d + (posDif.z * posDif.z))

	return distance3d;
}

function getDistanceFromSquare(pointPos, objectPos, size, bumpPower, tiles) {

	let offset = [Math.abs(pointPos.x - objectPos.x) - size.x, Math.abs(pointPos.y - objectPos.y) - size.y, Math.abs(pointPos.z - objectPos.z) - size.z];

	let unsignedDist = length([Math.max(offset[0], 0), Math.max(offset[1], 0), Math.max(offset[2], 0)]);

	return unsignedDist;
}

function distFromCubeWithSphereHole(pointPos, objectPos, size, bumpPower, tiles) {
	let sphereDist = getDistance(objectPos, pointPos) - size.r;
	let cubeDist = getDistanceFromSquare(pointPos, objectPos, size, bumpPower, tiles)

	return Math.max(-sphereDist, cubeDist);
}

function distFromSphereWithFlatSides(pointPos, objectPos, size, bumpPower, tiles) {
	let sphereDist = getDistance(objectPos, pointPos) - size.r;
	let cubeDist = getDistanceFromSquare(pointPos, objectPos, size, bumpPower, tiles)

	return Math.max(sphereDist, cubeDist);
}

function getDistanceFromGyroid(pointPos, objectPos, size, bumpPower, tiles) {

	//let gyroid = dot([Math.sin(pointPos.x * size.x), Math.sin(pointPos.y * size.y), Math.sin(pointPos.z * size.z)], [Math.cos(pointPos.z * size.z), Math.cos(pointPos.x * size.x), Math.cos(pointPos.y * size.y)])

	let repeatAmount = 100

	let gyroid2 = distFromCubeWithSphereHole({ x: pointPos.x % repeatAmount, y: pointPos.y % repeatAmount, z: pointPos.z % repeatAmount }, objectPos, size, bumpPower, tiles);

	return gyroid2;
}

dot = (a, b) => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);

function length(posDif) {
	let distance2d = (posDif[0] * posDif[0]) + (posDif[1] * posDif[1])

	let distance3d = Math.sqrt(distance2d + (posDif[2] * posDif[2]))

	return distance3d;
}

function lightPixel(worldPos, objectColour, pixelX, pixelY) {

	let calcColour = {
		r: objectColour[0],
		g: objectColour[1],
		b: objectColour[2],
		isInShadow: false
	}

	if (!lightWorld) {
		return calcColour;
	}

	for (let i = 0; i < worldLights.length; i++) {

		if (getDistance(worldPos, { x: worldLights[i][0][0], y: worldLights[i][0][1], z: worldLights[i][0][2] }) > worldLights[i][5]) {
			continue;
		}

		// Calculate direction to light source

		let dir = [worldLights[i][0][0] - worldPos.x, worldLights[i][0][1] - worldPos.y, worldLights[i][0][2] - worldPos.z]

		div = Math.abs(dir[0]) + Math.abs(dir[1]) + Math.abs(dir[2]);

		let worldLightDirection = [dir[0] / div, dir[1] / div, dir[2] / div];

		// Move ray to starting position

		let startDist = 2;

		let newPos = [worldPos.x + (startDist * worldLightDirection[0]), worldPos.y + (startDist * worldLightDirection[1]), worldPos.z + (startDist * worldLightDirection[2])]

		let hasFinished = false;

		while (!hasFinished) {

			let dist = getLargestSafeDistance(newPos[0], newPos[1], newPos[2]);

			if (dist[1] < 0.01) {
				// Hit object

				// Use the closest pass by to add soft shadows
				calcColour = {
					r: lerp(calcColour.r, 0, worldAmbience),
					g: lerp(calcColour.g, 0, worldAmbience),
					b: lerp(calcColour.b, 0, worldAmbience),
					isInShadow: true
				}

				hasFinished = true;
			}
			else if (dist[1] > getDistance({ x: worldLights[i][0][0], y: worldLights[i][0][1], z: worldLights[i][0][2] }, { x: newPos[0], y: newPos[1], z: newPos[2] })) {
				// Hit light

				// Calculate pixel brightness

				let lightDist = getDistance({ x: worldLights[i][0][0], y: worldLights[i][0][1], z: worldLights[i][0][2] }, camera);

				let lightIntensity = worldLights[i][2] / (lightDist ^ 2);

				calcColour.r *= worldLights[i][3][0] * Math.max(Math.min(1, lightIntensity), 0);
				calcColour.g *= worldLights[i][3][1] * Math.max(Math.min(1, lightIntensity), 0);
				calcColour.b *= worldLights[i][3][2] * Math.max(Math.min(1, lightIntensity), 0);

				hasFinished = true;
			}

			newPos = [newPos[0] + (dist[1] * worldLightDirection[0]), newPos[1] + (dist[1] * worldLightDirection[1]), newPos[2] + (dist[1] * worldLightDirection[2])];

		}

	}

	return calcColour;
}

function radToDeg(radians) {
	var pi = Math.PI;
	return radians * (180 / pi);
}

function degToRad(deg) {
	return deg * (Math.PI / 180);
}

function lerp(start, end, amt) {
	return (1 - amt) * start + amt * end;
}

// Movement

let keyboard = {}

document.addEventListener("keydown", e => {

	keyboard[e.key.toString().toUpperCase()] = true;

	if (e.key.toString().toUpperCase() == "H") {
		pixelSize = Number(prompt("What would you like the pixel size to be? \n(The smaller number the better the resolution)"));
	}

	if (e.key.toString().toUpperCase() == "G") {
		lightWorld = !lightWorld;
	}

	if (e.key.toString().toUpperCase() == "J") {
		pixelSize = Number(prompt("What would you like the pixel size to be for the slow render? \n(The smaller number the better the resolution)"));

		slowRender = !slowRender;
		stillRendering = true;
	}

	if (e.key.toString().toUpperCase() == "F") {
		if (confirm("Would you like to change scenes?")) {
			currentScene += 1

			if (currentScene > scenesCount) {
				currentScene = 1;
			}

			gameobjects = []
			worldLights = []

			renderScene(currentScene);
		}
	}

})

document.addEventListener("keyup", e => {
	keyboard[e.key.toString().toUpperCase()] = false;
})

function processInput() {

	let div = Math.abs(Math.sin(camera.yRot)) + Math.abs(Math.sin(camera.xRot)) + Math.abs(Math.cos(camera.yRot));

	if (div == 0) {
		div = 1;
	}

	if (keyboard["W"] == true) {
		camera.x += (camera.moveSpeed * Math.sin(camera.yRot) * camera.deltaTime) / div;
		camera.z += (camera.moveSpeed * Math.cos(camera.yRot) * camera.deltaTime) / div;

		camera.y += (camera.moveSpeed * Math.sin(camera.xRot) * camera.deltaTime) / div;
	}

	if (keyboard["S"] == true) {
		camera.x -= (camera.moveSpeed * Math.sin(camera.yRot) * camera.deltaTime) / div;
		camera.z -= (camera.moveSpeed * Math.cos(camera.yRot) * camera.deltaTime) / div;

		camera.y -= (camera.moveSpeed * Math.sin(camera.xRot) * camera.deltaTime) / div;
	}

	if (keyboard["D"] == true) {
		camera.x += (camera.moveSpeed * Math.sin(camera.yRot + (Math.PI / 2)) * camera.deltaTime) / div;
		camera.z += (camera.moveSpeed * Math.cos(camera.yRot + (Math.PI / 2)) * camera.deltaTime) / div;
	}

	if (keyboard["A"] == true) {
		camera.x += (camera.moveSpeed * Math.sin(camera.yRot - (Math.PI / 2)) * camera.deltaTime) / div;
		camera.z += (camera.moveSpeed * Math.cos(camera.yRot -r (Math.PI / 2)) * camera.deltaTime) / div;
	}

}

function lockChangeAlert() {

	if (document.pointerLockElement === canvas ||
		document.mozPointerLockElement === canvas) {

		document.addEventListener("mousemove", getMouseMovement, false);

	} else {

		document.removeEventListener("mousemove", getMouseMovement, false);

	}
}


function getMouseMovement(e) {

	let movementX = e.movementX || e.mozMovementX || 0;
	let movementY = e.movementY || e.mozMovementY || 0;

	camera.yRot -= movementX * camera.sensitivity;
	camera.xRot -= movementY * camera.sensitivity;
}

let workers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function renderViewport() {

	let totalCamRot = Math.abs(Math.sin(camera.yRot)) + Math.abs(Math.sin(camera.xRot)) + Math.abs(Math.cos(camera.yRot))

	if (slowRender) {
		for (let i = 0; i < 80; i++) {

			if (stillRendering) {

				if (renderPosHolder[0] == 0 && renderPosHolder[1] == 0) {
					// At the first pixel
					ctx.clearRect(0, 0, canvas.width, canvas.height);

					// Create worker

					if (window.Worker) {

						for (let w = 0; w < workers.length; w++) {
							workers[w] = new Worker('worker.js');

							workers[w].onmessage = (msg) => {
								drawPixel(msg.data.x, msg.data.y, msg.data.colour)
							}
						}

					}

				}

				renderPosHolder[1] += pixelSize;

				if (renderPosHolder[1] >= window.innerWidth) {
					renderPosHolder[1] = 0;
					renderPosHolder[0] += pixelSize;
				}

				if (renderPosHolder[0] >= window.innerHeight) {
					// Finished render
					renderPosHolder[0] = 0;
					renderPosHolder[1] = 0;

					stillRendering = false;
				}

				let x = renderPosHolder[1];
				let y = renderPosHolder[0];

				let workerData = {
					gameobjects: gameobjects,
					pixelSize: pixelSize,
					worldLights: worldLights,
					camera: camera,
					windowWidth: window.innerWidth,
					windowHeight: window.innerHeight,
					x: x,
					y: y,
					lightWorld: lightWorld,
					ambience: worldAmbience,
					maxBounces: maxBounces
				}

				if ((x % workers.length != 0) && window.Worker) {
					workers[x % workers.length].postMessage(workerData);
				}
				else {

					let pixelColour = getPixelColour(x, y, totalCamRot);

					drawPixel(x, y, pixelColour)
				}

			}
		}

	}
	else {

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (let x = 0; x < window.innerWidth; x += pixelSize) {
			for (let y = 0; y < window.innerHeight; y += pixelSize) {

				let pixelColour = getPixelColour(x, y, totalCamRot)

				drawPixel(x, y, pixelColour)
			}
		}

	}

}

/* ------------------------- */

function renderScene(sceneID) {

	if (sceneID == 1) {

		let light = createNewWorldLight([-250, -250, -175], 10000, rgb(255, 255, 240), Infinity)

		let floor = addNewGameObject({
			position: { x: 5000, y: 100, z: 5000 },
			scale: { x: 9000, y: 1, z: 9000 },
			colour: rgb(170, 170, 170),
			model: "box",
			reflectivity: 0.3,
			normal: [1, -1, 1],
			smoothness: 1
		})

		let cube = addNewGameObject({
			position: { x: -200, y: 0, z: 800 },
			scale: { x: 100, y: 100, z: 100, r: 110 },
			colour: rgb(17, 170, 17),
			model: "boxHole",
			reflectivity: 0,
			smoothness: 1
		})

		let ball1 = addNewGameObject({
			position: { x: 100, y: -50, z: 2000 },
			scale: { r: 150 },
			colour: rgb(187, 17, 17),
			model: "sphere",
			reflectivity: 0,
			smoothness: 1
		})

		let ball2 = addNewGameObject({
			position: { x: 500, y: -100, z: 1500 },
			scale: { x: 190, y: 190, z: 190, r: 230 },
			colour: rgb(17, 17, 187),
			model: "flatSphere",
			reflectivity: 0,
			smoothness: 1
		})

		let cube2 = addNewGameObject({
			position: { x: 100, y: 0, z: -1000 },
			scale: { x: 80, y: 80, z: 80 },
			colour: rgb(19, 19, 19),
			model: "box",
			reflectivity: 0,
			normal: [1, -1, 1],
			smoothness: 1
		})

	}
	else if (sceneID == 2) {

		setAmbience(0.8);

		let light2 = createNewWorldLight([0, -90, 350], 1000, rgb(255, 255, 255), Infinity)

		let floor = addNewGameObject({
			position: { x: 0, y: 100, z: 350 },
			scale: { x: 100, y: 1, z: 100 },
			colour: rgb(190, 190, 190),
			model: "box",
			reflectivity: 0.7,
			normal: [1, -1, 1],
			smoothness: 1
		})

		let wall1 = addNewGameObject({
			position: { x: 100, y: 0, z: 350 },
			scale: { x: 5, y: 100, z: 100 },
			colour: rgb(200, 50, 50),
			model: "box",
			reflectivity: 0.7,
			normal: [-1, 1, 1],
			smoothness: 1
		})

		let wall2 = addNewGameObject({
			position: { x: -100, y: 0, z: 350 },
			scale: { x: 5, y: 100, z: 100 },
			colour: rgb(50, 50, 200),
			model: "box",
			reflectivity: 0.7,
			normal: [-1, 1, 1],
			smoothness: 1
		})

		let roof = addNewGameObject({
			position: { x: 0, y: -100, z: 350 },
			scale: { x: 100, y: 1, z: 100 },
			colour: rgb(50, 180, 50),
			model: "box",
			reflectivity: 0.7,
			normal: [1, -1, 1],
			smoothness: 1
		})

		let backing = addNewGameObject({
			position: { x: 0, y: 0, z: 450 },
			scale: { x: 100, y: 100, z: 1 },
			colour: rgb(50, 200, 200),
			model: "box",
			reflectivity: 0.7,
			normal: [1, 1, -1],
			smoothness: 1
		})

		// Add spheres in the box

		let ball1 = addNewGameObject({
			position: { x: 40, y: 60, z: 325 },
			scale: { r: 40 },
			colour: rgb(190, 190, 190),
			model: "sphere",
			reflectivity: 0,
			normal: [-1, 1, 1],
			smoothness: 1
		})

		let ball2 = addNewGameObject({
			position: { x: -40, y: 60, z: 375 },
			scale: { r: 40 },
			colour: rgb(200, 150, 200),
			model: "sphere",
			reflectivity: 0,
			normal: [-1, 1, 1],
			smoothness: 1
		})

	}
	else if (sceneID == 3) {

		setAmbience(1);

		let light3 = createNewWorldLight([-1000, -400, -100], 1000, rgb(255, 255, 255), Infinity)

		let water = addNewGameObject({
			position: { x: 0, y: 100, z: 400 },
			scale: { x: 300, y: 1, z: 8000 },
			colour: rgb(20, 180, 220),
			model: "box",
			reflectivity: 0.5,
			normal: [1, -1, 1],
			smoothness: 0.7
		})

		let wall1 = addNewGameObject({
			position: { x: 150, y: -400, z: 400 },
			scale: { x: 5, y: 1000, z: 8000 },
			colour: rgb(238, 238, 238),
			model: "box",
			reflectivity: 0.08,
			normal: [-1, 1, 1],
			smoothness: 0.9
		})

		let wall2Lower = addNewGameObject({
			position: { x: -150, y: 250, z: 400 },
			scale: { x: 10, y: 200, z: 8000 },
			colour: rgb(238, 238, 238),
			model: "box",
			reflectivity: 0.08,
			normal: [-1, 1, 1],
			smoothness: 0.9
		})

		let wall2Upper = addNewGameObject({
			position: { x: -150, y: -800, z: 400 },
			scale: { x: 10, y: 600, z: 8000 },
			colour: rgb(255, 255, 255),
			model: "box",
			reflectivity: 0.08,
			normal: [-1, 1, 1],
			smoothness: 0.9
		})


		for (let i = 0; i < 30; i++) {
			let wall2WindowFrame = addNewGameObject({
				position: { x: -150, y: -175, z: i * 200 },
				scale: { x: 10, y: 550, z: 20 },
				colour: rgb(255, 255, 255),
				model: "box",
				reflectivity: 0.08,
				normal: [-1, 1, 1],
				smoothness: 0.9
			})
		}

		let roof = addNewGameObject({
			position: { x: 0, y: -900, z: 400 },
			scale: { x: 300, y: 1, z: 8000 },
			colour: rgb(170, 170, 170),
			model: "box",
			reflectivity: 0.08,
			normal: [1, -1, 1],
			smoothness: 0.9
		})

		let endWall = addNewGameObject({
			position: { x: 0, y: -400, z: 4700 },
			scale: { x: 1000, y: 1200, z: 1 },
			colour: rgb(170, 170, 170),
			model: "box",
			reflectivity: 0.08,
			normal: [1, 1, -1],
			smoothness: 0.9
		})

	}
}

renderScene(currentScene);


let scene = {
	FPS: 0,
	recordedFPS: 0,
	lastDate: Date.now()
}

function gameLoop() {

	camera.deltaTime = 1 / scene.recordedFPS;

	scene.lastDate = Date.now();

	//camera.yRot += 0.05;

	//worldLights[0][0] = [camera.x, camera.y, camera.z];

	processInput();

	renderViewport();

	scene.FPS += 1;

	document.getElementById("batchingTime").innerText = "Batching Time: " + (Date.now() - scene.lastDate) + " ms";

	requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

function resetFPS() {
	document.getElementById("FPS-display").innerText = "FPS: " + scene.FPS;

	scene.recordedFPS = scene.FPS;
	scene.FPS = 0;
}

let fpsInterval = setInterval(resetFPS, 1000);
