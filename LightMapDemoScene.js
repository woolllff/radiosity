'use strict';

// Array flattening trick from http://stackoverflow.com/questions/10865025/merge-flatten-a-multidimensional-array-in-javascript

var LightMapDemoScene = function (gl) {
	this.gl = gl;
};

LightMapDemoScene.prototype.Load = function (cb) {
	console.log('Loading demo scene');

	var me = this;

	this.canvasImage = document.getElementById('imageE');
	// this.context = canvasImage.getContext('2d');

	async.parallel({
		Models: function (callback) {
			async.map({
				RoomModel: 'Room.json'
			}, LoadJSONResource, callback);
		},
		ShaderCode: function (callback) {
			async.map({
				'NoShadow_VSText': 'shaders/NoShadow.vs.glsl',
				'NoShadow_FSText': 'shaders/NoShadow.fs.glsl',
				'Shadow_VSText': 'shaders/Shadow.vs.glsl',
				'Shadow_FSText': 'shaders/Shadow.fs.glsl',
				'ShadowMapGen_VSText': 'shaders/ShadowMapGen.vs.glsl',
				'ShadowMapGen_FSText': 'shaders/ShadowMapGen.fs.glsl',
				'radiosityColorPass_1_VSText': 'shaders/radiosityColorPass_1.vs.glsl',
				'radiosityColorPass_1_FSText': 'shaders/radiosityColorPass_1.fs.glsl',
				'radiosityColorPass_2_VSText': 'shaders/radiosityColorPass_2.vs.glsl',
				'radiosityColorPass_2_FSText': 'shaders/radiosityColorPass_2.fs.glsl'
			}, LoadTextResource, callback);
		}
	}, function (loadErrors, loadResults) {
		if (loadErrors) {
			cb(loadErrors);
			return;
		}

		//
		// Create Model objects
		//
		for (var i = 0; i < loadResults.Models.RoomModel.meshes.length; i++) {
			var mesh = loadResults.Models.RoomModel.meshes[i];
			switch (mesh.name) {
				case 'MonkeyMesh':
					me.MonkeyMesh = new Model(
						me.gl,
						mesh.vertices,
						[].concat.apply([], mesh.faces),
						mesh.normals,
						vec4.fromValues(0.8, 0.8, 1.0, 1.0)
					);
					mat4.rotate(
						me.MonkeyMesh.world, me.MonkeyMesh.world,
						glMatrix.toRadian(94.87),
						vec3.fromValues(0, 0, -1)
					);
					mat4.translate(
						me.MonkeyMesh.world, me.MonkeyMesh.world,
						vec4.fromValues(2.07919, -0.98559, 1.75740)
					);
					break;
				case 'TableMesh':
					me.TableMesh = new Model(
						me.gl, mesh.vertices, [].concat.apply([], mesh.faces),
						mesh.normals, vec4.fromValues(1, 0, 1, 1)
					);
					mat4.translate(
						me.TableMesh.world, me.TableMesh.world,
						vec3.fromValues(1.57116, -0.79374, 0.49672)
					);
					break;
				case 'SofaMesh':
					me.SofaMesh = new Model(
						me.gl, mesh.vertices, [].concat.apply([], mesh.faces),
						mesh.normals, vec4.fromValues(0, 1, 1, 1)	
					);
					mat4.translate(
						me.SofaMesh.world, me.SofaMesh.world,
						vec3.fromValues(-3.28768, 0, 0.78448)
					);
					break;
				case 'LightBulbMesh':
					me.lightPosition = vec3.fromValues(0, 0.0, 2.58971);
					me.LightMesh = new Model(
						me.gl, mesh.vertices, [].concat.apply([], mesh.faces),
						mesh.normals, vec4.fromValues(4, 4, 4, 1)
					);
					mat4.translate(me.LightMesh.world, me.LightMesh.world,
						me.lightPosition
					);
					break;
				case 'WallsMesh':
					me.WallsMesh = new Model(
						me.gl, mesh.vertices, [].concat.apply([], mesh.faces),
						mesh.normals, vec4.fromValues(0.3, 0.3, 0.3, 1)
					);
					break;
			}
		}

		if (!me.MonkeyMesh) {
			cb('Failed to load monkey mesh'); return;
		}
		if (!me.TableMesh) {
			cb('Failed to load table mesh'); return;
		}
		if (!me.SofaMesh) {
			cb('Failed to load sofa mesh'); return;
		}
		if (!me.LightMesh) {
			cb('Failed to load light mesh'); return;
		}
		if (!me.WallsMesh) {
			cb('Failed to load walls mesh'); return;
		}
		me.Meshes = [
			me.MonkeyMesh,
			me.TableMesh,
			me.SofaMesh,
			me.LightMesh,
			me.WallsMesh
		];

		//
		// Create Shaders
		//
		me.NoShadowProgram = CreateShaderProgram(
			me.gl, loadResults.ShaderCode.NoShadow_VSText,
			loadResults.ShaderCode.NoShadow_FSText
		);
		if (me.NoShadowProgram.error) {
			cb('NoShadowProgram ' + me.NoShadowProgram.error); return;
		}

		me.ShadowProgram = CreateShaderProgram(
			me.gl, loadResults.ShaderCode.Shadow_VSText,
			loadResults.ShaderCode.Shadow_FSText
		);
		if (me.ShadowProgram.error) {
			cb('ShadowProgram ' + me.ShadowProgram.error); return;
		}

		me.ShadowMapGenProgram = CreateShaderProgram(
			me.gl, loadResults.ShaderCode.ShadowMapGen_VSText,
			loadResults.ShaderCode.ShadowMapGen_FSText
		);
		if (me.ShadowMapGenProgram.error) {
			cb('ShadowMapGenProgram ' + me.ShadowMapGenProgram.error); return;
		}

		me.radiosityColorPass_1_Program = CreateShaderProgram(
			me.gl, loadResults.ShaderCode.radiosityColorPass_1_VSText,
			loadResults.ShaderCode.radiosityColorPass_1_FSText
		);
		if (me.radiosityColorPass_1_Program.error) {
			cb('radiosityColorPass_1_Program ' + me.radiosityColorPass_1_Program.error); return;
		}

		// me.radiosityColorPass_2_Program = CreateShaderProgram(
		// 	me.gl, loadResults.ShaderCode.radiosityColorPass_2_VSText,
		// 	loadResults.ShaderCode.radiosityColorPass_2_FSText
		// );
		// if (me.radiosityColorPass_2_Program.error) {
		// 	cb('radiosityColorPass_2_Program ' + me.radiosityColorPass_2_Program.error); return;
		// }

		//
		// set shaders uniforms 
		//
		me.NoShadowProgram.uniforms = {
			mProj: me.gl.getUniformLocation(me.NoShadowProgram, 'mProj'),
			mView: me.gl.getUniformLocation(me.NoShadowProgram, 'mView'),
			mWorld: me.gl.getUniformLocation(me.NoShadowProgram, 'mWorld'),

			pointLightPosition: me.gl.getUniformLocation(me.NoShadowProgram, 'pointLightPosition'),
			meshColor: me.gl.getUniformLocation(me.NoShadowProgram, 'meshColor'),
		};
		me.NoShadowProgram.attribs = {
			vPos: me.gl.getAttribLocation(me.NoShadowProgram, 'vPos'),
			vNorm: me.gl.getAttribLocation(me.NoShadowProgram, 'vNorm'),
		};

		me.ShadowProgram.uniforms = {
			mProj: me.gl.getUniformLocation(me.ShadowProgram, 'mProj'),
			mView: me.gl.getUniformLocation(me.ShadowProgram, 'mView'),
			mWorld: me.gl.getUniformLocation(me.ShadowProgram, 'mWorld'),

			pointLightPosition: me.gl.getUniformLocation(me.ShadowProgram, 'pointLightPosition'),
			meshColor: me.gl.getUniformLocation(me.ShadowProgram, 'meshColor'),
			lightShadowMap: me.gl.getUniformLocation(me.ShadowProgram, 'lightShadowMap'),
			shadowClipNearFar: me.gl.getUniformLocation(me.ShadowProgram, 'shadowClipNearFar'),

			bias: me.gl.getUniformLocation(me.ShadowProgram, 'bias')
		};
		me.ShadowProgram.attribs = {
			vPos: me.gl.getAttribLocation(me.ShadowProgram, 'vPos'),
			vNorm: me.gl.getAttribLocation(me.ShadowProgram, 'vNorm'),

			radiosityColor : me.gl.getAttribLocation(me.ShadowProgram, 'radiosityColor'),
		};

		me.ShadowMapGenProgram.uniforms = {
			mProj: me.gl.getUniformLocation(me.ShadowMapGenProgram, 'mProj'),
			mView: me.gl.getUniformLocation(me.ShadowMapGenProgram, 'mView'),
			mWorld: me.gl.getUniformLocation(me.ShadowMapGenProgram, 'mWorld'),

			pointLightPosition: me.gl.getUniformLocation(me.ShadowMapGenProgram, 'pointLightPosition'),
			shadowClipNearFar: me.gl.getUniformLocation(me.ShadowMapGenProgram, 'shadowClipNearFar'),
		};
		me.ShadowMapGenProgram.attribs = {
			vPos: me.gl.getAttribLocation(me.ShadowMapGenProgram, 'vPos'),
		};


		me.radiosityColorPass_1_Program.uniforms = {
			mProj: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'mProj'),
			mView: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'mView'),
			mWorld: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'mWorld'),

			pointLightPosition: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'pointLightPosition'),
			lightShadowMap: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'lightShadowMap'),
			shadowClipNearFar: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'shadowClipNearFar'),

			bias: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'bias'),
			fragColor: me.gl.getUniformLocation(me.radiosityColorPass_1_Program, 'fragColor'),
		};
		me.radiosityColorPass_1_Program.attribs = {
			vPos: me.gl.getAttribLocation(me.radiosityColorPass_1_Program, 'vPos'),
			vNorm: me.gl.getAttribLocation(me.radiosityColorPass_1_Program, 'vNorm'),

			radiosityColor : me.gl.getAttribLocation(me.radiosityColorPass_1_Program, 'radiosityColor'),

		};

		//
		// Create Framebuffers and Textures
		//
		me.shadowMapCube = me.gl.createTexture();
		me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, me.shadowMapCube);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_MIN_FILTER, me.gl.LINEAR);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_MAG_FILTER, me.gl.LINEAR);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_WRAP_S, me.gl.MIRRORED_REPEAT);
		me.gl.texParameteri(me.gl.TEXTURE_CUBE_MAP, me.gl.TEXTURE_WRAP_T, me.gl.MIRRORED_REPEAT);
		me.floatExtension = me.gl.getExtension("OES_texture_float");
		me.floatLinearExtension = me.gl.getExtension("OES_texture_float_linear");
		if (me.floatExtension && me.floatLinearExtension) {
			for (var i = 0; i < 6; i++) {
				me.gl.texImage2D(
					me.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
					0, me.gl.RGBA,
					me.textureSize, me.textureSize,
					0, me.gl.RGBA,
					me.gl.FLOAT, null
				);
			}
		} else {
			for (var i = 0; i < 6; i++) {
				me.gl.texImage2D(
					me.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
					0, me.gl.RGBA,
					me.textureSize, me.textureSize,
					0, me.gl.RGBA,
					me.gl.UNSIGNED_BYTE, null
				);
			}
		}

		me.shadowMapFramebuffer = me.gl.createFramebuffer();
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, me.shadowMapFramebuffer);

		me.shadowMapRenderbuffer = me.gl.createRenderbuffer();
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, me.shadowMapRenderbuffer);
		me.gl.renderbufferStorage(
			me.gl.RENDERBUFFER, me.gl.DEPTH_COMPONENT16,
			me.textureSize, me.textureSize
		);

		me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, null);
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, null);
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, null);



		me.intermediateTexture = me.gl.createTexture();
		me.gl.bindTexture(me.gl.TEXTURE_2D, me.intermediateTexture);
		me.RadiosityFramebuffer = me.gl.createFramebuffer();
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, me.RadiosityFramebuffer);

		me.RadiosityRenderbuffer = me.gl.createRenderbuffer();
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, me.RadiosityRenderbuffer);
		me.gl.renderbufferStorage(
			me.gl.RENDERBUFFER, me.gl.DEPTH_COMPONENT16,
			me.textureSize, me.textureSize
		);

		me.gl.bindTexture(me.gl.TEXTURE_2D, null);
		me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, null);
		me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, null);

		//
		// Logical Values
		//
		me.camera = new Camera(
			vec3.fromValues(0, 0, 1.85),
			vec3.fromValues(-0.3, -1, 1.85),
			vec3.fromValues(0, 0, 1)
		);

		me.projMatrix = mat4.create();
		me.viewMatrix = mat4.create();

		mat4.perspective(
			me.projMatrix,
			glMatrix.toRadian(90),
			me.gl.canvas.clientWidth / me.gl.canvas.clientHeight,
			0.35,
			85.0
		);

		me.shadowMapCameras = [
			// Positive X
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(1, 0, 0)),
				vec3.fromValues(0, -1, 0)
			),
			// Negative X
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(-1, 0, 0)),
				vec3.fromValues(0, -1, 0)
			),
			// Positive Y
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 1, 0)),
				vec3.fromValues(0, 0, 1)
			),
			// Negative Y
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, -1, 0)),
				vec3.fromValues(0, 0, -1)
			),
			// Positive Z
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 0, 1)),
				vec3.fromValues(0, -1, 0)
			),
			// Negative Z
			new Camera(
				me.lightPosition,
				vec3.add(vec3.create(), me.lightPosition, vec3.fromValues(0, 0, -1)),
				vec3.fromValues(0, -1, 0)
			),
		];
		me.shadowMapViewMatrices = [
			mat4.create(),
			mat4.create(),
			mat4.create(),
			mat4.create(),
			mat4.create(),
			mat4.create()
		];
		me.shadowMapProj = mat4.create();
		me.shadowClipNearFar = vec2.fromValues(0.05, 15.0);
		mat4.perspective(
			me.shadowMapProj,
			glMatrix.toRadian(90),
			1.0,
			me.shadowClipNearFar[0],
			me.shadowClipNearFar[1]
		);

		cb();
	});

	me.PressedKeys = {
		Up: false,
		Right: false,
		Down: false,
		Left: false,
		Forward: false,
		Back: false,

		RotLeft: false,
		RotRight: false,
	};

	me.MoveForwardSpeed = 3.5;
	me.RotateSpeed = 1.5;
	me.textureSize = getParameterByName('texSize') || 1024;

	me.lightDisplacementInputAngle = 0.0;
};


LightMapDemoScene.prototype._getcolor = function() {
	var image = new Image();
	image.onload = function() {
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.intermediateTexture);
		this.gl.texImage2D(this.gl.TEXTURE_2D, 0, gl.RGBA,
					  this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
		}
	var canvasColor = document.createElement('canvas');
	var contextcolor = canvasColor.getContext('2d');
	contextcolor.drawImage(image, 0, 0);
	var color = 0;
	var x,y,count;
	for(x=0; x< canvasColor.width; x++)
	{
		for (y =0 ; canvasColor.height; y++)
		{
			count = count ++;
			color = color + contextcolor.getImageData(x,y,1,1).data;
		}
	}

	return color/count;

  }

LightMapDemoScene.prototype.Unload = function () {
	this.LightMesh = null;
	this.MonkeyMesh = null;
	this.TableMesh = null;
	this.SofaMesh = null;
	this.WallsMesh = null;

	this.NoShadowProgram = null;
	this.ShadowProgram = null;
	this.ShadowMapGenProgram = null;

	this.camera = null;
	this.lightPosition = null;

	this.Meshes = null;

	this.PressedKeys = null;

	this.MoveForwardSpeed = null;
	this.RotateSpeed = null;

	this.shadowMapCube = null;
	this.textureSize = null;

	this.shadowMapCameras = null;
	this.shadowMapViewMatrices = null;
};

LightMapDemoScene.prototype.Begin = function () {
	console.log('Beginning demo scene');

	var me = this;

	// Attach event listeners
	this.__ResizeWindowListener = this._OnResizeWindow.bind(this);
	this.__KeyDownWindowListener = this._OnKeyDown.bind(this);
	this.__KeyUpWindowListener = this._OnKeyUp.bind(this);

	AddEvent(window, 'resize', this.__ResizeWindowListener);
	AddEvent(window, 'keydown', this.__KeyDownWindowListener);
	AddEvent(window, 'keyup', this.__KeyUpWindowListener);
	
	// Render Loop
	var previousFrame = performance.now();
	var dt = 0;
	me._GenerateShadowMapLight();
	var loop = function (currentFrameTime) {
		dt = currentFrameTime - previousFrame;
		me._Update(dt);
		previousFrame = currentFrameTime;

		me._GenerateShadowMapFragment();
		me._Render();
		me.nextFrameHandle = requestAnimationFrame(loop);
	};
	me.nextFrameHandle = requestAnimationFrame(loop);

	me._OnResizeWindow();
};

LightMapDemoScene.prototype.End = function () {
	if (this.__ResizeWindowListener) {
		RemoveEvent(window, 'resize', this.__ResizeWindowListener);
	}
	if (this.__KeyUpWindowListener) {
		RemoveEvent(window, 'keyup', this.__KeyUpWindowListener);
	}
	if (this.__KeyDownWindowListener) {
		RemoveEvent(window, 'keydown', this.__KeyDownWindowListener);
	}

	if (this.nextFrameHandle) {
		cancelAnimationFrame(this.nextFrameHandle);
	}
};

//
// Private Methods
//

LightMapDemoScene.prototype._Update_shadowMapCameras = function(fragPos){

	this.shadowMapCameras = [
		// Positive X
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(1, 0, 0)),
			vec3.fromValues(0, -1, 0)
		),
		// Negative X
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(-1, 0, 0)),
			vec3.fromValues(0, -1, 0)
		),
		// Positive Y
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(0, 1, 0)),
			vec3.fromValues(0, 0, 1)
		),
		// Negative Y
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(0, -1, 0)),
			vec3.fromValues(0, 0, -1)
		),
		// Positive Z
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(0, 0, 1)),
			vec3.fromValues(0, -1, 0)
		),
		// Negative Z
		new Camera(
			fragPos,
			vec3.add(vec3.create(), fragPos, vec3.fromValues(0, 0, -1)),
			vec3.fromValues(0, -1, 0)
		),
	];
};



LightMapDemoScene.prototype._Update = function (dt) {
	// mat4.rotateZ(
	// 	this.MonkeyMesh.world, this.MonkeyMesh.world,
	// 	dt / 1000 * 2 * Math.PI *    0.3
	// );

	if (this.PressedKeys.Forward && !this.PressedKeys.Back) {
		this.camera.moveForward(dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.Back && !this.PressedKeys.Forward) {
		this.camera.moveForward(-dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.Right && !this.PressedKeys.Left) {
		this.camera.moveRight(dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.Left && !this.PressedKeys.Right) {
		this.camera.moveRight(-dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.Up && !this.PressedKeys.Down) {
		this.camera.moveUp(dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.Down && !this.PressedKeys.Up) {
		this.camera.moveUp(-dt / 1000 * this.MoveForwardSpeed);
	}

	if (this.PressedKeys.RotRight && !this.PressedKeys.RotLeft) {
		this.camera.rotateRight(-dt / 1000 * this.RotateSpeed);
	}

	if (this.PressedKeys.RotLeft && !this.PressedKeys.RotRight) {
		this.camera.rotateRight(dt / 1000 * this.RotateSpeed);
	}

	if (this.PressedKeys.PrintInfo) {

		console.log(this.intermediateTexture);
	}

	// this.lightDisplacementInputAngle += dt / 2337;
	// var xDisplacement = Math.sin(this.lightDisplacementInputAngle) * 2.8;

	// this.LightMesh.world[12] = xDisplacement;
	// for (var i = 0; i < this.shadowMapCameras.length; i++) {
	// 	mat4.getTranslation(this.shadowMapCameras[i].position, this.LightMesh.world);
	// 	this.shadowMapCameras[i].GetViewMatrix(this.shadowMapViewMatrices[i]);
	// }

	this.camera.GetViewMatrix(this.viewMatrix);
};

LightMapDemoScene.prototype._GenerateShadowMapLight = function () {
	var gl = this.gl;

	this._Update_shadowMapCameras(this.lightPosition);
	// Set GL state status
	gl.useProgram(this.ShadowMapGenProgram);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFramebuffer);
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.shadowMapRenderbuffer);

	gl.viewport(0, 0, this.textureSize, this.textureSize);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	// Set per-frame uniforms
	gl.uniform2fv(
		this.ShadowMapGenProgram.uniforms.shadowClipNearFar,
		this.shadowClipNearFar
	);
	gl.uniform3fv(
		this.ShadowMapGenProgram.uniforms.pointLightPosition,
		this.lightPosition
	);
	gl.uniformMatrix4fv(
		this.ShadowMapGenProgram.uniforms.mProj,
		gl.FALSE,
		this.shadowMapProj
	);

	for (var i = 0; i < this.shadowMapCameras.length; i++) {
		// Set per light uniforms
		gl.uniformMatrix4fv(
			this.ShadowMapGenProgram.uniforms.mView,
			gl.FALSE,
			this.shadowMapCameras[i].GetViewMatrix(this.shadowMapViewMatrices[i])
		);

		// Set framebuffer destination
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
			this.shadowMapCube,
			0
		);
		gl.framebufferRenderbuffer(
			gl.FRAMEBUFFER,
			gl.DEPTH_ATTACHMENT,
			gl.RENDERBUFFER,
			this.shadowMapRenderbuffer
		);

		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Draw meshes
		for (var j = 0; j < this.Meshes.length; j++) {
			// Per object uniforms
			gl.uniformMatrix4fv(
				this.ShadowMapGenProgram.uniforms.mWorld,
				gl.FALSE,
				this.Meshes[j].world
			);

			// Set attributes
			gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].vbo);
			gl.vertexAttribPointer(
				this.ShadowMapGenProgram.attribs.vPos,
				3, gl.FLOAT, gl.FALSE,
				0, 0
			);
			gl.enableVertexAttribArray(this.ShadowMapGenProgram.attribs.vPos);

			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[j].ibo);
			gl.drawElements(gl.TRIANGLES, this.Meshes[j].nPoints, gl.UNSIGNED_SHORT, 0);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		}
	}

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
};

LightMapDemoScene.prototype._exract_radiosity_color = function (){

	// {
	// 	var img = new Image();

		
	// 	this.context.drawImage(img, 0, 0);
	// 	this.context.getImageData(x, y, 1, 1).data;
	// }

	return vec3.fromValues(0,0,0);

}

LightMapDemoScene.prototype._genereteCamera = function (vertex , normal){

var axis, up,temp;
var max =0;

max = vec3.dot(normal, vec3.fromValues(1, 0, 0));
axis = vec3.fromValues(1, 0, 0);
up = vec3.fromValues(0, -1, 0);

temp = vec3.dot(normal, vec3.fromValues(-1, 0, 0));
if(max < temp)
{
	axis = vec3.fromValues(-1, 0, 0);
	up = vec3.fromValues(0, -1, 0);
}
temp = vec3.dot(normal, vec3.fromValues(0, 1, 0));
if(max < temp)
{
	axis = vec3.fromValues(0, 1, 0);
	up = vec3.fromValues(0, 0, 1);
}
temp = vec3.dot(normal, vec3.fromValues(0, -1, 0));
if(max < temp)
{
	axis = vec3.fromValues(0, -1, 0);
	up = vec3.fromValues(0, 0, -1);
}

temp = vec3.dot(normal, vec3.fromValues(0, 0, 1));
if(max < temp)
{
	axis = vec3.fromValues(0, 0, 1);
	up = vec3.fromValues(0, -1, 0);
}
temp = vec3.dot(normal, vec3.fromValues(0, 0, -1));
if(max < temp)
{
	axis = vec3.fromValues(0, 0, -1);
	up = vec3.fromValues(0, -1, 0);
}

	var camera = new Camera(vertex,vec3.add(vec3.create(), vertex, axis),up);

	return camera;

}


LightMapDemoScene.prototype._updateColor = function (list_color, index_to_update_at){

	// extract color from intermideate texture 
	var color = this._exract_radiosity_color();

	list_color[3*index_to_update_at] = color[0];
	list_color[3*index_to_update_at+1] = color[1];
	list_color[3*index_to_update_at+2] = color[2];
	
	return list_color;

}


LightMapDemoScene.prototype._GenerateShadowMapFragment = function () {
	var gl = this.gl;

	// Set GL state status
	gl.useProgram(this.radiosityColorPass_1_Program);
	gl.bindTexture(gl.TEXTURE_2D, this.intermediateTexture);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.RadiosityFramebuffer);
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.RadiosityRenderbuffer);

	gl.viewport(0, 0, this.textureSize, this.textureSize);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	var radiosityColorMesh;
	if (this.floatExtension && this.floatLinearExtension) {
		gl.uniform1f(this.radiosityColorPass_1_Program.uniforms.bias, 0.0001);
	} else {
		gl.uniform1f(this.radiosityColorPass_1_Program.uniforms.bias, 0.003);
	}
	gl.uniform1i(this.radiosityColorPass_1_Program.uniforms.lightShadowMap, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);

	// Set per-frame uniforms

	gl.uniform2fv(
		this.radiosityColorPass_1_Program.uniforms.shadowClipNearFar,
		this.shadowClipNearFar
	);
	gl.uniform3fv(
		this.radiosityColorPass_1_Program.uniforms.pointLightPosition,
		this.lightPosition
	);
	gl.uniformMatrix4fv(
		this.radiosityColorPass_1_Program.uniforms.mProj,
		gl.FALSE,
		this.shadowMapProj
	);
	for(var k = 0; k < this.Meshes.length; k++ ) // all the fragments in all the meshes , ie all the vertex 
	{
		// generate camers for all the frag pos 
		radiosityColorMesh = [] //  initilize to size of vertex in mesh[k] 

		for (var i = 0; i < this.Meshes[k].vertices.length; i++) 
		{
			var camera = this._genereteCamera(vec3.fromValues( this.Meshes[k].vertices[3*i],
				this.Meshes[k].vertices[3*i +1],
				this.Meshes[k].vertices[3*i +2]),
				vec3.fromValues( this.Meshes[k].normals[3*i],
				this.Meshes[k].normals[3*i +1],
				this.Meshes[k].normals[3*i +2]) 
			); // calculate camera from one vertex and normal 
			
			gl.uniformMatrix4fv(
				this.radiosityColorPass_1_Program.uniforms.mView,
				gl.FALSE,
				camera.GetViewMatrix(mat4.create())
			);
			// Set per light uniforms
			// gl.uniformMatrix4fv(
			// 	this.radiosityColorPass_1_Program.uniforms.mView,
			// 	gl.FALSE,
			// 	this.radiosityCamera.GetViewMatrix(this.radiosityViewMatrices)
			// );

			// Set framebuffer destination
			gl.framebufferTexture2D(
				gl.FRAMEBUFFER,
				gl.COLOR_ATTACHMENT0,
				gl.TEXTURE_2D,
				this.intermediateTexture,
				0
			);
			gl.framebufferRenderbuffer(
				gl.FRAMEBUFFER,
				gl.DEPTH_ATTACHMENT,
				gl.RENDERBUFFER,
				this.RadiosityRenderbuffer
			);

			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			// Draw meshes
			for (var j = 0; j < this.Meshes.length; j++) 
			{
				// Per object uniforms
				gl.uniformMatrix4fv(
					this.radiosityColorPass_1_Program.uniforms.mWorld,
					gl.FALSE,
					this.Meshes[j].world
				);
				gl.uniform4fv(
					this.radiosityColorPass_1_Program.uniforms.fragColor,
					this.Meshes[j].color
				);

				// Set attributes
				gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].vbo);
				gl.vertexAttribPointer(
					this.radiosityColorPass_1_Program.attribs.vPos,
					3, gl.FLOAT, gl.FALSE,
					0, 0
				);
				gl.enableVertexAttribArray(this.radiosityColorPass_1_Program.attribs.vPos);

				gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].nbo);
				gl.vertexAttribPointer(
					this.radiosityColorPass_1_Program.attribs.vNorm,
					3, gl.FLOAT, gl.FALSE,
					0, 0
				);
				gl.enableVertexAttribArray(this.radiosityColorPass_1_Program.attribs.vNorm);



				gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].rcb);
				gl.vertexAttribPointer(
					this.radiosityColorPass_1_Program.attribs.radiosityColor,
					3, gl.FLOAT, gl.FALSE,
					0, 0
				);
				gl.enableVertexAttribArray(this.radiosityColorPass_1_Program.attribs.radiosityColor);



				gl.bindBuffer(gl.ARRAY_BUFFER, null);

				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[j].ibo);
				gl.drawElements(gl.TRIANGLES, this.Meshes[j].nPoints, gl.UNSIGNED_SHORT, 0);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
			}
			radiosityColorMesh = this._updateColor(radiosityColorMesh, i); // update the color value at the value of index 
			this.Meshes[k].radiosityColor = radiosityColorMesh;
		}
	}

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
}



LightMapDemoScene.prototype._Render = function () {
	var gl = this.gl;

	// Clear back buffer, set per-frame uniforms
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);

	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

	gl.useProgram(this.ShadowProgram);
	gl.uniformMatrix4fv(this.ShadowProgram.uniforms.mProj, gl.FALSE, this.projMatrix);
	gl.uniformMatrix4fv(this.ShadowProgram.uniforms.mView, gl.FALSE, this.viewMatrix);
	gl.uniform3fv(this.ShadowProgram.uniforms.pointLightPosition, this.lightPosition);
	gl.uniform2fv(this.ShadowProgram.uniforms.shadowClipNearFar, this.shadowClipNearFar);
	if (this.floatExtension && this.floatLinearExtension) {
		gl.uniform1f(this.ShadowProgram.uniforms.bias, 0.0001);
	} else {
		gl.uniform1f(this.ShadowProgram.uniforms.bias, 0.003);
	}
	gl.uniform1i(this.ShadowProgram.uniforms.lightShadowMap, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);

	// Draw meshes
	for (var i = 0; i < this.Meshes.length; i++) {
		// Per object uniforms
		gl.uniformMatrix4fv(
			this.ShadowProgram.uniforms.mWorld,
			gl.FALSE,
			this.Meshes[i].world
		);
		gl.uniform4fv(
			this.ShadowProgram.uniforms.meshColor,
			this.Meshes[i].color
		);

		// Set attributes
		gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[i].vbo);
		gl.vertexAttribPointer(
			this.ShadowProgram.attribs.vPos,
			3, gl.FLOAT, gl.FALSE,
			0, 0
		);
		gl.enableVertexAttribArray(this.ShadowProgram.attribs.vPos);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[i].nbo);
		gl.vertexAttribPointer(
			this.ShadowProgram.attribs.vNorm,
			3, gl.FLOAT, gl.FALSE,
			0, 0
		);
		gl.enableVertexAttribArray(this.ShadowProgram.attribs.vNorm);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[i].rcb);
		gl.vertexAttribPointer(
			this.ShadowProgram.attribs.radiosityColor,
			3, gl.FLOAT, gl.FALSE,
			0, 0
		);
		gl.enableVertexAttribArray(this.ShadowProgram.attribs.radiosityColor);		

		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[i].ibo);
		gl.drawElements(gl.TRIANGLES, this.Meshes[i].nPoints, gl.UNSIGNED_SHORT, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	}
};

//
// Event Listeners
//
LightMapDemoScene.prototype._OnResizeWindow = function () {
	var gl = this.gl;

	var targetHeight = window.innerWidth * 9 / 16;

	if (window.innerHeight > targetHeight) {
		// Center vertically
		gl.canvas.width = window.innerWidth;
		gl.canvas.height = targetHeight;
		gl.canvas.style.left = '0px';
		gl.canvas.style.top = (window.innerHeight - targetHeight) / 2 + 'px';
	} else {
		// Center horizontally
		gl.canvas.width = window.innerHeight * 16 / 9;
		gl.canvas.height = window.innerHeight;
		gl.canvas.style.left = (window.innerWidth - (gl.canvas.width)) / 2 + 'px';
		gl.canvas.style.top = '0px';
	}

	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
};

LightMapDemoScene.prototype._OnKeyDown = function (e) {
	switch(e.code) {
		case 'KeyW':
			this.PressedKeys.Forward = true;
			break;
		case 'KeyA':
			this.PressedKeys.Left = true;
			break;
		case 'KeyD':
			this.PressedKeys.Right = true;
			break;
		case 'KeyS':
			this.PressedKeys.Back = true;
			break;
		case 'ArrowUp':
			this.PressedKeys.Up = true;
			break;
		case 'ArrowDown':
			this.PressedKeys.Down = true;
			break;
		case 'ArrowRight':
			this.PressedKeys.RotRight = true;
			break;
		case 'ArrowLeft':
			this.PressedKeys.RotLeft = true;
			break;
		case 'KeyI':
			this.PressedKeys.PrintInfo = true;
			break;
	}
};

LightMapDemoScene.prototype._OnKeyUp = function (e) {
	switch(e.code) {
		case 'KeyW':
			this.PressedKeys.Forward = false;
			break;
		case 'KeyA':
			this.PressedKeys.Left = false;
			break;
		case 'KeyD':
			this.PressedKeys.Right = false;
			break;
		case 'KeyS':
			this.PressedKeys.Back = false;
			break;
		case 'ArrowUp':
			this.PressedKeys.Up = false;
			break;
		case 'ArrowDown':
			this.PressedKeys.Down = false;
			break;
		case 'ArrowRight':
			this.PressedKeys.RotRight = false;
			break;
		case 'ArrowLeft':
			this.PressedKeys.RotLeft = false;
			break;
		case 'KeyI':
			this.PressedKeys.PrintInfo = false;
			break;
	}
};