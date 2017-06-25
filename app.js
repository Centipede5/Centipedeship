var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var SOCKET_LIST = {};

var Entity = function(){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2)+Math.pow(self.y-pt.y,2));
	}
	return self;
}

var Player = function(id,type,teamdecider){
	var self = Entity();
	self.type = type;
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.killcount = 0;
	teamdecider = teamdecider;
	self.team = 'blue';
	if (Math.round(teamdecider) > 0){
		self.team = 'red';
	}
	else if (Math.round(teamdecider) < 0){
		self.team = 'blue';
	}
	if (self.type === 'tank'){
		self.maxSpd = 10;
		self.health = 10;
		self.toRemove = false;
		self.shoottimer = 0;
		self.bulletSpread = 4;
		self.reloadTime = 10;
		self.bulletDamage = 5;
	}
	else if (self.type === 'mothership'){
		self.maxSpd = 1;
		self.health = 1000;
		self.toRemove = false;
		self.shoottimer = 0;
		self.bulletSpread = 4;
		self.reloadTime = 2;
		self.bulletDamage = 5;
	}
	
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		if(self.pressingAttack){
		if (self.shoottimer >= self.reloadTime){
		var variation = (Math.floor(Math.random()*self.bulletSpread))-(self.bulletSpread/2);
		if (self.type === 'tank'){
		self.shootBullet(self.mouseAngle+variation, self.bulletDamage);
		}
		if (self.type === 'mothership'){
		self.shootBullet(self.mouseAngle+variation+180, self.bulletDamage);
		self.shootBullet(self.mouseAngle+variation, self.bulletDamage);
		}
		self.shoottimer = 0;
		}
		
		else {
			self.shoottimer++;
		}
		}
		if (self.health < 0){
			//console.log('remove');
			self.toRemove = true;
		}
	
	}
	self.shootBullet = function(angle,bulletDamage){
		var b = Bullet(self.id,angle,bulletDamage,self.team);
		b.x = self.x;
		b.y = self.y;  
	
	}
	
	self.updateSpd = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;		
	}
	Player.list[id] = self;
	return self;
}
Player.list = {};
var numplayers = 0;
var playersteam = '';

Player.onConnect = function(socket){
	var newtank = '';
	numplayers ++;
	//if(Math.round(numplayers/2)=== numplayers){
		//playerteam = 'red';
	//}
	//else{
		//playerteam = 'blue';
	//}
	if (numplayers === 1){
		newtank = 'mothership';
		playersteam = -1;
		console.log('mothership added');
	}
	else if (numplayers === 2){
		newtank = 'mothership';
		playersteam = 1;
		console.log('mothership added');
	}
	else{
		newtank = 'tank';
		playersteam = Math.random();
	}
	var player = Player(socket.id,newtank, playersteam);
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
}
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];	
		player.update();
		if(player.toRemove){
			delete Player.list[i];
		}
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number,
			type:player.type,
			kills:player.killcount,
			team:player.team
		});		
	}
	return pack;
}


var Bullet = function(parent,angle,bulletDamage,team){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 20;
	self.spdY = Math.sin(angle/180*Math.PI) * 20;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 10)
			self.toRemove = true;
		super_update();
		for(var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) <32 && self.parent !== p.id && team !==p.team){
				console.log(team + ' vs ' + p.team);
				p.health -=bulletDamage;
				if (p.health < 0){
				for (var i in Player.list){
					var p = Player.list[i];
					if(p.id === self.parent){
					p.killcount++;
					//console.log(p.killcount);
					}
				}
			}
				//console.log('collision'+p.health);
				self.toRemove=true;
				
			}
		}
		
	}
	Bullet.list[self.id] = self;
	return self;
}
Bullet.list = {};

Bullet.update = function(){
	
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove)
			delete Bullet.list[i];
		else
		pack.push({
			x:bullet.x,
			y:bullet.y,
		});		
	}
	return pack;
}

var DEBUG = false;

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	Player.onConnect(socket);
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('sendMsgToServer',function(data){
		var playerName = (""+socket.id).slice(2,7);
		for(var i in SOCKET_LIST)
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
	});
	
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);
	});	
});

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
},1000/25);
