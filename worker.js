// Workers to speed up rendering all the pixels

let gameobjects = []

let pixelSize = 10;

let worldLights = [];

let lightWorld = true;

let maxBounces = 6;

let worldAmbience = 0.3;

let camera = {
	x: 0,
	y: 0,
	z: 0,
	xRot: 0,
	yRot: 0,
	zRot: 0
}

let window = {
	innerWidth: 2000,
	innerHeight: 1000
}

self.onmessage = (msg) => {

	gameobjects = msg.data.gameobjects;
	pixelSize = msg.data.pixelSize;
	worldLights = msg.data.worldLights
	worldAmbience = msg.data.ambience
	camera = msg.data.camera
	window.innerWidth = msg.data.windowWidth
	window.innerHeight = msg.data.windowHeight
	lightWorld = msg.data.lightWorld
	maxBounces = msg.data.maxBounces

	let render = renderViewport(msg.data.x, msg.data.y);

	self.postMessage({ colour: render, x: msg.data.x, y: msg.data.y });
}

function getPixelColour(x, y) {
	let currentPos = { x: camera.x, y: camera.y, z: camera.z }

	let cameraFOVCalc = {
		x: ((window.innerWidth / 2) - x) / ((window.innerWidth / 2) / degToRad(camera.fov / 2)),
		y: ((window.innerHeight / 2) - y) / ((window.innerWidth / 2) / degToRad(camera.fov / 2))
	}

	let calcDir = [Math.sin(camera.yRot + cameraFOVCalc.x), Math.sin(camera.xRot + cameraFOVCalc.y), Math.cos(camera.yRot + cameraFOVCalc.x)]

	let div = Math.abs(Math.sin(camera.yRot)) + Math.abs(Math.sin(camera.xRot)) + Math.abs(Math.cos(camera.yRot));

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

		let startDist = 0.2;

		let newPos = [worldPos.x + (startDist * worldLightDirection[0]), worldPos.y + (startDist * worldLightDirection[1]), worldPos.z + (startDist * worldLightDirection[2])]

		let hasFinished = false;

		while (!hasFinished) {

			let dist = getLargestSafeDistance(newPos[0], newPos[1], newPos[2]);

			if (dist[1] < 0.01) {
				// Hit object
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

function renderViewport(x, y) {

	let pixelColour = getPixelColour(x, y)

	return pixelColour;
}