export class MPT_Voice {

    //create a new voice using the given audiocontext and destinationNode (default ctx destination)
    constructor(name, ctx, cnv = document.createElement("canvas")) {
        this.name = name;
        this.ctx = ctx;

        this.glottis = new AudioWorkletNode(this.ctx, 'glottis', {
            numberOfInputs: 1, //aspiration noise
            numberOfOutputs: 2, //glottal source, noise modulator
            outputChannelCount: [1, 1], 
            processorOptions: { name: this.name }
        });

        this.tract = new AudioWorkletNode(this.ctx, "tract", {
            numberOfInputs: 3, //glottal source, fricative noise, noise modulator
            numberOfOutputs: 1,
            outputChannelCount: [2],
            processorOptions: { name: this.name }
        });
        this.glottis.connect(this.tract, 0, 0);
        this.glottis.connect(this.tract, 1, 2);

        this.gainNode = new GainNode(this.ctx, {gain: 1});
        this.tract.connect(this.gainNode);

        this.tract.port.onmessage = (e) => {
            this.d = e.data.d; 
            this.v = e.data.v;
        };

        const sampleRate = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
        const bufSamps = buf.getChannelData(0);
        for (let i = 0; i < sampleRate * 2; i++) { 
            bufSamps[i] = Math.random();
        };

        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buf;
        this.noiseNode.loop = true;
        this.noiseNode.start();

        this.aspiration = this.ctx.createBiquadFilter();
        this.aspiration.type = "bandpass";
        this.aspiration.frequency.value = 500;
        this.aspiration.Q.value = 0.5;        
        this.aspiration.connect(this.glottis, 0, 0);
        this.noiseNode.connect(this.aspiration);
        
        this.fricative = this.ctx.createBiquadFilter();
        this.fricative.type = "bandpass";
        this.fricative.frequency.value = 1000;
        this.fricative.Q.value = 0.5;
        this.fricative.connect(this.tract, 0, 1);
        this.noiseNode.connect(this.fricative);

        // this.filters = new Array(20).fill(undefined).map(() => new BiquadFilterNode(this.ctx));
        // this.filters.forEach((f, i) => {
        //     f.Q.value = 4.31
        //     if (i == 0) this.filters[i].type = "lowshelf";
        //     else if (i == this.filters.length - 1) this.filters[i].type = "highshelf";
        //     else this.filters[i].type = "peaking";
        // });

        this.UI = new TractUI(this, cnv);
    }

    connect(destination = this.ctx.destination) {
        this.gainNode.connect(destination);
        console.log(`Voice ${this.name} connected.`);
    }
    
    disconnect() {
        this.gainNode.disconnect();
        console.log(`Voice ${this.name} disconnected.`);
    }

    setGain(gain) {
        this.gainNode.gain.value = gain;
    }

    setN(n) {
        this.tract.parameters.get("n").value = n;
        this.UI.init(this.tract.parameters.get("n").value);
    }

    setFrequency(f) {
        this.glottis.parameters.get("frequency").value = f;
    }

    setDiameters(d, targetOnly = false) {

        const tract_n = this.tract.parameters.get("n").value;

        //resample inputted diameters to tract length
        let resampled = d.length == tract_n ? d 
            : new Float64Array(tract_n).map((v, i) => {
                let i_scaled = i / (tract_n-1) * (d.length-1);
                let interpVal = i_scaled % 1; 
                if (interpVal == 0) return d[i_scaled];

                let i1 = Math.floor(i_scaled);
                let i2 = Math.floor(i_scaled) + 1;

                v = d[i1]*(1-interpVal) + d[i2]*interpVal;
                return v;
            });
        
        this.tract.port.postMessage({td: resampled});
        if (!targetOnly) this.tract.port.postMessage({d: resampled});
    }
}

class TractUI {

    originX = 340;
    originY = 500; 
    radius = 298; 
    scale = 70;
    tongueIndex = 12.9;
    tongueDiameter = 2.43;
    innerTongueControlRadius = 2.05;
    outerTongueControlRadius = 3.5;
    angleScale = 0.64;
    angleOffset = -0.24;
    noseOffset = 0.8;
    gridOffset = 1.7;
    fillColour = 'pink';
    lineColour = '#C070C6';

    touchesWithMouse = [];


    //pass an MPT_Voice class object and an HTMLCanvasElement
    constructor(voice, cnv = document.createElement("canvas")) {
        this.voice = voice;
        this.cnv = cnv;
        this.ctx = this.cnv.getContext("2d");

        this.cnv.width = 600;
        this.cnv.height = 600;

        this.cnv.addEventListener("mousedown", (e) => this.startMouse(e));
        this.cnv.addEventListener("mousemove", (e) => this.moveMouse(e));
        this.cnv.addEventListener("mouseup", (e) => this.endMouse(e));

        this.init();
    }

    init(n = 44) {

        this.n = n;

        this.bladeStart = Math.floor(10 * this.n / 44);
        this.tipStart = Math.floor(32 * this.n / 44);
        this.lipStart = Math.floor(39 * this.n / 44);

        this.noseLength = Math.floor(28 * this.n / 44);
        this.noseStart = this.n - this.noseLength + 1;
        this.noseDiameter = new Float64Array(this.noseLength);
        for (let i = 0; i < this.noseLength; i++) {
            let diameter;
            let d = 2 * (i / this.noseLength);
            if (d < 1) diameter = 0.4 + 1.6 * d;
            else diameter = 0.5 + 1.5 * (2 - d);
            diameter = Math.min(diameter, 1.9);
            this.noseDiameter[i] = diameter;
        }

        this.tongueLowerIndexBound = this.bladeStart + 2; 
        this.tongueUpperIndexBound = this.tipStart - 3;   
        this.tongueIndexCentre = 0.5*(this.tongueLowerIndexBound+this.tongueUpperIndexBound);
    }

    startMouse(e) {
        let touch = {
            alive: true,
            x: (e.pageX-this.cnv.offsetLeft)/this.cnv.getBoundingClientRect().width*600,
            y: (e.pageY-this.cnv.offsetTop)/this.cnv.getBoundingClientRect().width*600
        };

        touch.index = this.getIndex(touch.x, touch.y);
        touch.diameter = this.getDiameter(touch.x, touch.y);

        if (touch.index >= this.tongueLowerIndexBound-4 && touch.index<=this.tongueUpperIndexBound+4 
            && touch.diameter >= this.innerTongueControlRadius-0.5 && touch.diameter <= this.outerTongueControlRadius+0.5)
        {
            this.tongueTouch = touch;
        }

        this.mouseTouch = touch;
        this.touchesWithMouse.push(touch);   
        this.handleTouches();
    }

    moveMouse(e)
    {
        let touch = this.mouseTouch;
        if (!touch?.alive) return;
        touch.x = (e.pageX-this.cnv.offsetLeft)/this.cnv.getBoundingClientRect().width*600;
        touch.y = (e.pageY-this.cnv.offsetTop)/this.cnv.getBoundingClientRect().width*600;
        touch.index = this.getIndex(touch.x, touch.y);
        touch.diameter = this.getDiameter(touch.x, touch.y); 
        this.handleTouches();
    }

    endMouse() {
        let touch = this.mouseTouch;
        if (!touch.alive) return;
        touch.alive = false;
        this.handleTouches();

        this.voice.tract.parameters.get("constriction-index").value = 0;
        this.voice.tract.parameters.get("constriction-diameter").value = 0;
    }

    handleTouches() {

        let index, diameter;

        if (this.tongueTouch && !this.tongueTouch.alive) this.tongueTouch = undefined;

        if (this.tongueTouch) {
            var x = this.tongueTouch.x;
            var y = this.tongueTouch.y;        
            index = this.getIndex(x,y);
            diameter = this.getDiameter(x,y);
            var fromPoint = (this.outerTongueControlRadius-diameter)/(this.outerTongueControlRadius-this.innerTongueControlRadius);
            fromPoint = constrain(fromPoint, 0, 1);
            fromPoint = Math.pow(fromPoint, 0.58) - 0.2*(fromPoint*fromPoint-fromPoint); //horrible kludge to fit curve to straight line
            this.tongueDiameter = constrain(diameter, this.innerTongueControlRadius, this.outerTongueControlRadius);
            this.tongueIndex = constrain(index, this.tongueLowerIndexBound, this.tongueUpperIndexBound);
            var out = fromPoint*0.5*(this.tongueUpperIndexBound-this.tongueLowerIndexBound);
            this.tongueIndex = constrain(index, this.tongueIndexCentre-out, this.tongueIndexCentre+out);

            this.voice.tract.parameters.get("tongue-index").value = this.tongueIndex;
            this.voice.tract.parameters.get("tongue-diameter").value = this.tongueDiameter;
        }

        this.voice.tract.parameters.get('velum-target').value = 0.01

        for (let j=0; j<this.touchesWithMouse.length; j++) {
            var touch = this.touchesWithMouse[j];
            if (!touch.alive) continue;            
            var x = touch.x;
            var y = touch.y;
            index = this.getIndex(x,y);
            diameter = this.getDiameter(x,y) - 0.3;

            this.voice.tract.parameters.get('constriction-index').value = index || 0;
            this.voice.tract.parameters.get('constriction-diameter').value = diameter || 0;
        }

        this.voice.tract.parameters.get('fricative-strength').value = 1;
    }

    getIndex(x, y) {
        var xx = x-this.originX; var yy = y-this.originY;
        var angle = Math.atan2(yy, xx);
        while (angle> 0) angle -= 2*Math.PI;
        return (Math.PI + angle - this.angleOffset)*(this.lipStart-1) / (this.angleScale*Math.PI);
    }

    getDiameter(x, y) {
        var xx = x-this.originX; var yy = y-this.originY;
        return (this.radius-Math.sqrt(xx*xx + yy*yy))/this.scale;
    }

    draw() {
        if (!this.ctx || !this.voice.d) return;

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.ctx.lineCap = 'round';        
        this.ctx.lineJoin = 'round';  
        
        this.drawTongueControl();
        
        var velum = this.voice.v;
        var velumAngle = velum * 4;
        
        //first draw fill
        this.ctx.beginPath();        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.fillColour;
        this.ctx.fillStyle = this.fillColour;

        this.moveTo(1,0);
        for (let i = 1; i < this.n; i++) {
            this.lineTo(i, this.voice.d[i]);
        }
        for (let i = this.n-1; i >= 2; i--) this.lineTo(i, 0);  
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
        
        //for nose
        this.ctx.beginPath();        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.fillColour;
        this.ctx.fillStyle = this.fillColour;
        this.moveTo(this.noseStart, -this.noseOffset);
        for (let i = 1; i < this.noseLength; i++) this.lineTo(i+this.noseStart, -this.noseOffset - this.noseDiameter[i]*0.9);
        for (let i = this.noseLength-1; i >= 1; i--) this.lineTo(i+this.noseStart, -this.noseOffset);  
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();

        //velum
        this.ctx.beginPath();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.fillColour;
        this.ctx.fillStyle = this.fillColour;
        this.moveTo(this.noseStart-2, 0);
        this.lineTo(this.noseStart, -this.noseOffset);
        this.lineTo(this.noseStart+velumAngle, -this.noseOffset);
        this.lineTo(this.noseStart+velumAngle-2, 0);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();

        //white text
        this.ctx.fillStyle = "white";
        this.ctx.font="20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.globalAlpha = 1.0;
        this.drawText(this.n*0.10, 0.425, "throat");         
        this.drawText(this.n*0.71, -1.8, "nasal");
        this.drawText(this.n*0.71, -1.3, "cavity");
        this.ctx.font="22px Arial";        
        this.drawText(this.n*0.64, 1.1, "oral");    
        this.drawText(this.n*0.74, 1.1, "cavity"); 

        this.drawAmplitudes(); 

        //then draw lines
        this.ctx.beginPath();        
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = this.lineColour;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';          
        this.moveTo(1, this.voice.d[0]);
        for (let i = 2; i < this.n; i++) this.lineTo(i, this.voice.d[i]);
        this.moveTo(1,0);
        for (let i = 2; i <= this.noseStart-2; i++) this.lineTo(i, 0);
        this.moveTo(this.noseStart+velumAngle-2,0);
        for (let i = this.noseStart+Math.ceil(velumAngle)-2; i < this.n; i++) this.lineTo(i, 0);   
        this.ctx.stroke();

        //for nose
        this.ctx.beginPath();        
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = this.lineColour;
        this.ctx.lineJoin = 'round';  
        this.moveTo(this.noseStart, -this.noseOffset);
        for (let i = 1; i < this.noseLength; i++) this.lineTo(i+this.noseStart, -this.noseOffset - this.noseDiameter[i]*0.9);
        this.moveTo(this.noseStart+velumAngle, -this.noseOffset);
        for (let i = Math.ceil(velumAngle); i < this.noseLength; i++) this.lineTo(i+this.noseStart, -this.noseOffset);
        this.ctx.stroke();
                
        //velum
        this.ctx.globalAlpha = velum*5;
        this.ctx.beginPath();
        this.moveTo(this.noseStart-2, 0);
        this.lineTo(this.noseStart, -this.noseOffset);
        this.moveTo(this.noseStart+velumAngle-2, 0);
        this.lineTo(this.noseStart+velumAngle, -this.noseOffset);  
        this.ctx.stroke();
        
        this.ctx.fillStyle = "orchid";
        this.ctx.font="20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.globalAlpha = 0.7;
        this.drawText(this.n*0.93, 0.8+0.8*this.voice.d[this.n-1], " lip"); 

        this.drawBackground();
        this.drawPositions();

        if (this.voice.ctx.state != "running") {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
            this.ctx.fillRect(0, 0, this.cnv.width, this.cnv.height);
        };
    }

    moveTo(i, d) {
        var angle = this.angleOffset + i * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*d;
        var x = this.originX-r*Math.cos(angle);
        var y = this.originY-r*Math.sin(angle);
        this.ctx.moveTo(x, y);
    }
    
    lineTo(i, d) {
        var angle = this.angleOffset + i * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*d;
        var x = this.originX-r*Math.cos(angle);
        var y = this.originY-r*Math.sin(angle);
        this.ctx.lineTo(x, y);
    }

    drawCircle(i, d, radius)
    {
        var angle = this.angleOffset + i * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*d; 
        this.ctx.beginPath();
        this.ctx.arc(this.originX-r*Math.cos(angle), this.originY-r*Math.sin(angle), radius, 0, 2*Math.PI);
        this.ctx.fill();
    }

    drawTongueControl() {
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.strokeStyle = "#ffeef5"; //pale pink
        this.ctx.fillStyle = "#ffeef5";
        this.ctx.globalAlpha = 1.0;
        this.ctx.beginPath();
        this.ctx.lineWidth = 45;
        
        //outline
        this.moveTo(this.tongueLowerIndexBound, this.innerTongueControlRadius);
        for (let i=this.tongueLowerIndexBound+1; i<=this.tongueUpperIndexBound; i++) this.lineTo(i, this.innerTongueControlRadius);
        this.lineTo(this.tongueIndexCentre, this.outerTongueControlRadius);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
        
        var a = this.innerTongueControlRadius;
        var c = this.outerTongueControlRadius;
        var b = 0.5*(a+c);
        var r = 3;
        this.ctx.fillStyle = "orchid";
        this.ctx.globalAlpha = 0.3;        
        this.drawCircle(this.tongueIndexCentre, a, r);
        this.drawCircle(this.tongueIndexCentre-4.25, a, r);
        this.drawCircle(this.tongueIndexCentre-8.5, a, r);
        this.drawCircle(this.tongueIndexCentre+4.25, a, r);
        this.drawCircle(this.tongueIndexCentre+8.5, a, r);
        this.drawCircle(this.tongueIndexCentre-6.1, b, r);    
        this.drawCircle(this.tongueIndexCentre+6.1, b, r);  
        this.drawCircle(this.tongueIndexCentre, b, r);  
        this.drawCircle(this.tongueIndexCentre, c, r);
        
        this.ctx.globalAlpha = 1.0;         

        //circle for tongue position
        var angle = this.angleOffset + this.tongueIndex * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*(this.tongueDiameter);
        var x = this.originX-r*Math.cos(angle);
        var y = this.originY-r*Math.sin(angle);
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = "orchid";
        this.ctx.globalAlpha = 0.7;
        this.ctx.beginPath();
        this.ctx.arc(x,y, 18, 0, 2*Math.PI);
        this.ctx.stroke();        
        this.ctx.globalAlpha = 0.15;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    
        this.ctx.fillStyle = "orchid";
    }

    drawText(i, d, text) {
        var angle = this.angleOffset + i * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*d; 
        this.ctx.save();
        this.ctx.translate(this.originX-r*Math.cos(angle), this.originY-r*Math.sin(angle)+2); //+8);
        this.ctx.rotate(angle-Math.PI/2);
        this.ctx.fillText(text, 0, 0);
        this.ctx.restore();
    }

    drawTextStraight(i, d, text) {
        var angle = this.angleOffset + i * this.angleScale * Math.PI / (this.lipStart-1);
        var r = this.radius - this.scale*d; 
        this.ctx.save();
        this.ctx.translate(this.originX-r*Math.cos(angle), this.originY-r*Math.sin(angle)+2); //+8);
        this.ctx.fillText(text, 0, 0);
        this.ctx.restore();
    }

    drawAmplitudes() {
        this.ctx.strokeStyle = "orchid";
        this.ctx.lineCap = "butt";
        this.ctx.globalAlpha = 0.3;
        for (let i=2; i<this.n-1; i++)
        {
            this.ctx.beginPath();
            this.ctx.lineWidth = 1; //Math.sqrt(Tract.maxAmplitude[i])*3;
            this.moveTo(i, 0);
            this.lineTo(i, this.voice.d[i]);
            this.ctx.stroke();
        }
        for (let i=1; i<this.noseLength-1; i++)
        {
            this.ctx.beginPath();
            this.ctx.lineWidth = 1; //Math.sqrt(Tract.noseMaxAmplitude[i]) * 3;
            this.moveTo(i+this.noseStart, -this.noseOffset);
            this.lineTo(i+this.noseStart, -this.noseOffset - this.noseDiameter[i]*0.9);
            this.ctx.stroke();
        }
        this.ctx.globalAlpha = 1;
    }

    drawBackground()
    {
        
        //text
        this.ctx.fillStyle = "black";
        this.ctx.font="20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.globalAlpha = 0.7;
        this.drawText(this.n*0.44, -0.28, "soft");
        this.drawText(this.n*0.51, -0.28, "palate");
        this.drawText(this.n*0.77, -0.28, "hard");
        this.drawText(this.n*0.84, -0.28, "palate");
        this.drawText(this.n*0.95, -0.28, " lip");
        
        this.ctx.font="17px Arial";        
        this.drawTextStraight(this.n*0.18, 3, "  tongue control");   
        this.ctx.textAlign = "left";
        this.drawText(this.n*1.03, -1.07, "nasals");
        this.drawText(this.n*1.03, -0.28, "stops");
        this.drawText(this.n*1.03, 0.51, "fricatives");
        //this.drawTextStraight(1.5, +0.8, "glottis")
        this.ctx.strokeStyle = "orchid";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.moveTo(this.n*1.03, 0); this.lineTo(this.n*1.07, 0); 
        this.moveTo(this.n*1.03, -this.noseOffset); this.lineTo(this.n*1.07,  -this.noseOffset); 
        this.ctx.stroke();
        this.ctx.globalAlpha = 0.9;
        this.ctx.globalAlpha = 1.0;
    }

    drawPositions()
    {
        this.ctx.fillStyle = "orchid";
        this.ctx.font="24px Arial";
        this.ctx.textAlign = "center";
        this.ctx.globalAlpha = 0.6;
        var a = 2;
        var b = 1.5;
        this.drawText(15/44*this.n, a+b*0.60, 'æ'); //pat
        this.drawText(13/44*this.n, a+b*0.27, 'ɑ'); //part
        this.drawText(12/44*this.n, a+b*0.00, 'ɒ'); //pot
        this.drawText(17.7/44*this.n, a+b*0.05, '(ɔ)'); //port (rounded)
        this.drawText(27/44*this.n, a+b*0.65, 'ɪ'); //pit
        this.drawText(27.4/44*this.n, a+b*0.21, 'i'); //peat
        this.drawText(20/44*this.n, a+b*1.00, 'e'); //pet
        this.drawText(18.1/44*this.n, a+b*0.37, 'ʌ'); //putt   
            //put ʊ
        this.drawText(23/44*this.n, a+b*0.1, '(u)'); //poot (rounded)   
        this.drawText(21/44*this.n, a+b*0.6, 'ə'); //pert [should be ɜ]
        
        var nasals = -1.1;
        var stops = -0.4;
        var fricatives = 0.5;
        var approximants = 0.9;
        this.ctx.globalAlpha = 0.8;
        
        //approximants
        this.drawText(38/44*this.n, approximants, 'L');
        this.drawText(41/44*this.n, approximants, 'w');
        this.drawText(28.6/44*this.n, approximants, "R")
        
        //?
        this.drawText(4.5/44*this.n, 0.37, 'H');
        
        //voiced consonants
        this.drawText(33/44*this.n, fricatives, 'ʒ/ʃ');     
        this.drawText(36.5/44*this.n, fricatives, 'z/s');
        this.drawText(39.5/44*this.n, fricatives, 'v/f');
        this.drawText(22/44*this.n, stops, 'g/k');
        this.drawText(35/44*this.n, stops, 'd/t');
        this.drawText(41.5/44*this.n, stops, 'b/p');
        this.drawText(22/44*this.n, nasals, 'ŋ');
        this.drawText(35/44*this.n, nasals, 'n');
        this.drawText(41/44*this.n, nasals, 'm');  

    }
}

function constrain(n, low, high) {
    return Math.max(Math.min(n, high), low);
};