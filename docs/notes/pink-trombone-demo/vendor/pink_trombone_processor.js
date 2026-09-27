/*
    Modular Pink Trombone
    By Yonatan Rozin

    A modular version of Pink Trombone that allows for faster audio processing
    and multiple simultaneous voices.

    Modifications from original:
    -   Deprecated ScriptProcessorNode has been replaced with new AudioWorkletNode
            - This allows the audio processing to run in a separate thread from
            the main script, making it MUCH faster and non-blocking
    -   Pink Trombone objects (Tract, Glottis) integrated as AudioWorkletProcessor
        class objects, allowing for multiple simultaneous Pink Trombone voices
            - The original noise module has been made into a class, allowing for
            each voice to have its own noise modules, with a unique noise seed.
            This allows noisy signals (ex. vibrato) to be different per voice
            This de-syncing can be reversed by setting the noise seeds to the same
            number (this.noise.seed(0)) in VocalWorkletProcessor constructor
    -   UI has been removed, it may possibly be re-integrated later.
    -   Tract.addTurbulenceNoise() has been modified (since UI has been removed)
        to allow fricatives to still be produced:
            - Instead of relying on UI touches, addTurbulence noise simulates "touch"
            using the value and location of the smallest current diameter, aka the
            point of highest constriction in the vocal tract. These values are updated
            constantly in Tract.reshapeTract(). A new fIntensity
            variable has been added to the Tract object that determines the volume
            of fricative noise. This allows letters that differ only by fricative
            volume (for example, T and N) to remain distinguishable from one another

    Built using Pink Trombone
    version 1.1, March 2017
    by Neil Thapen
    venuspatrol.nfshost.com

    Copyright 2017 Neil Thapen

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and / or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
*/
import Noise from "./noise.js";

function clamp(number, min, max) {
  if (number < min) return min;
  else if (number > max) return max;
  else return number;
}

function moveTowards(current, target, amountUp, amountDown) {
  if (current < target) return Math.min(current + amountUp, target);
  else return Math.max(current - amountDown, target);
}

class GlottisProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      //frequency: sets the fundamental pitch of the voice
      {
        name: "frequency",
        defaultValue: 140,
        minValue: 20,
        maxValue: 2000,
        automationRate: "k-rate"
      },
      //intensity: volume of voiced (pitched) aspect of the voice. Does not affect fricatives and transients.
      {
        name: "intensity",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate"
      },
      //tenseness: affects base voice timbre, from "breathy" to "strained"
      {
        name: "tenseness",
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate"
      },
      //a multiplier of the tenseness value. Scales final tenseness value between 0 and tenseness param
      {
        name: "tenseness-mult",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate"
      },
      //vibrato amount - affects width of vibrato (pitch oscillation)
      {
        name: "vibrato-amount",
        defaultValue: 0.005,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate"
      },
      //vibrato frequency - affects speed of vibrato
      {
        name: "vibrato-frequency",
        defaultValue: 6,
        minValue: 0,
        maxValue: 100,
        automationRate: "k-rate"
      },
      //pitchbend - adjusts the fundamental frequency up or down a specified # of semitones
      {
        name: "pitchbend",
        defaultValue: 0,
        minValue: -24,
        maxValue: 24,
        automationRate: "a-rate"
      }
    ];
  }

  //code below based on original Pink Trombone Glottis

  //these parameters are written to every "frame" with user-specified AudioParam values 
  UITenseness = 0.6;
  UIFrequency = 140;
  vibratoAmount = 0.005;
  vibratoFrequency = 6;
  intensity = 0;
  loudness = 1;

  //these parameters are modified by internal methods of the object
  totalTime = 0;
  timeInWaveform = 0;
  waveformLength = 0;
  oldFrequency = 140;
  newFrequency = 140;
  smoothFrequency = 140;
  oldTenseness = 0.6;
  newTenseness = 0.6;
  
  noise = new Noise();

  constructor(options) {
    super();
    this.init();
    this.i = options.processorOptions.i;
  }

  init() {
    this.setupWaveform(0);
  }

  setupWaveform(lambda) {
    this.frequency = this.oldFrequency * (1-lambda) + this.newFrequency * lambda;
    let tenseness = this.oldTenseness * (1-lambda) + this.newTenseness * lambda;
    this.Rd = 3 * (1 - tenseness);
    this.waveformLength = 1 / this.frequency;
    
    let Rd = this.Rd;
    if (Rd < 0.5) Rd = 0.5;
    if (Rd > 2.7) Rd = 2.7;
    // var output;
    // normalized to time = 1, Ee = 1
    let Ra = -0.01 + 0.048 * Rd;
    let Rk = 0.224 + 0.118 * Rd;
    let Rg = (Rk / 4) * (0.5 + 1.2 * Rk) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));
    
    let Ta = Ra;
    let Tp = 1 / (2 * Rg);
    let Te = Tp + Tp * Rk; 
    
    let epsilon = 1 / Ta;
    let shift = Math.exp(-epsilon * (1-Te));
    let Delta = 1 - shift; //divide by this to scale RHS
       
    let RHSIntegral = (1 / epsilon) * (shift - 1) + (1-Te) * shift;
    RHSIntegral = RHSIntegral/Delta;
    
    let totalLowerIntegral = -(Te-Tp)/2 + RHSIntegral;
    let totalUpperIntegral = -totalLowerIntegral;
    
    let omega = Math.PI / Tp;
    let s = Math.sin(omega * Te);
    // need E0*e^(alpha*Te)*s = -1 (to meet the return at -1)
    // and E0*e^(alpha*Tp/2) * Tp*2/pi = totalUpperIntegral 
    //             (our approximation of the integral up to Tp)
    // writing x for e^alpha,
    // have E0*x^Te*s = -1 and E0 * x^(Tp/2) * Tp*2/pi = totalUpperIntegral
    // dividing the second by the first,
    // letting y = x^(Tp/2 - Te),
    // y * Tp*2 / (pi*s) = -totalUpperIntegral;
    var y = -Math.PI * s * totalUpperIntegral / (Tp*2);
    var z = Math.log(y);
    var alpha = z / (Tp/2 - Te);
    var E0 = -1 / (s * Math.exp(alpha * Te));
    this.alpha = alpha;
    this.E0 = E0;
    this.epsilon = epsilon;
    this.shift = shift;
    this.Delta = Delta;
    this.Te = Te;
    this.omega = omega;
  }

  normalizedLFWaveform(t)
  {     
    let output;

    if (t > this.Te) output = (-Math.exp(-this.epsilon * (t - this.Te)) + this.shift) / this.Delta;

    else output = this.E0 * Math.exp(this.alpha * t) * Math.sin(this.omega * t);
  
    return output * this.intensity * this.loudness;
  }

  runStep(lambda, noiseSource) {
    let timeStep = 1.0 / sampleRate; 
    this.timeInWaveform += timeStep;
    this.totalTime += timeStep;
    if (this.timeInWaveform > this.waveformLength) 
    {
      this.timeInWaveform -= this.waveformLength;
      this.setupWaveform(lambda);
    }
    let out = this.normalizedLFWaveform(this.timeInWaveform/this.waveformLength);
    //MODIFIED: multiply aspiration by 3 to match original volume (why do we have to do this?)
    let aspiration = this.intensity * (1 - Math.sqrt(this.UITenseness)) * this.getNoiseModulator() * noiseSource * 8;
    aspiration *= 0.2 + 0.02 * this.noise.simplex1(this.totalTime * 1.99);
    out += aspiration;
    return out;
  }

  getNoiseModulator() {
    let voiced = 0.1 + 0.2 * Math.max(0,Math.sin(Math.PI * 2 * this.timeInWaveform / this.waveformLength));
    return this.UITenseness * this.intensity * voiced + (1 - this.UITenseness * this.intensity ) * 0.3;
  }

  finishBlock() {
    let vibrato = 0;
    vibrato += this.vibratoAmount * Math.sin(2 * Math.PI * this.totalTime * this.vibratoFrequency);          
    vibrato += 0.02 * this.noise.simplex1(this.totalTime * 4.07);
    // vibrato += 0.04 * this.noise.simplex1(this.totalTime * 2.15);

    if (this.UIFrequency > this.smoothFrequency) 
      this.smoothFrequency = Math.min(this.smoothFrequency * 1.1, this.UIFrequency);
    if (this.UIFrequency < this.smoothFrequency) 
      this.smoothFrequency = Math.max(this.smoothFrequency / 1.1, this.UIFrequency);
    this.oldFrequency = this.newFrequency;
    this.newFrequency = this.smoothFrequency * (1+vibrato);
    this.oldTenseness = this.newTenseness;
    this.newTenseness = this.UITenseness
      + 0.1 * this.noise.simplex1(this.totalTime * 0.46) + 0.05 * this.noise.simplex1(this.totalTime * 0.36);
  }

  // based on code from pink trombone AudioContext.doScriptProcessor()
  process(inputs, outputs, params) {

    //update a bunch of internal object properties using latest audioparam values

    //update k-rate parameter values for the current block
    this.vibratoAmount = params["vibrato-amount"][0];
    this.vibratoFrequency = params["vibrato-frequency"][0];
    
    //some voices dont't have inputs defined immediately (why?)
    if (!inputs[0][0]) return true; //output nothing (silence) until they're ready
    
    try {
      let inputArray = inputs[0][0];
      let outArray = outputs[0][0];

      let noiseModArray = outputs[1][0];
      
      //code taken from AudioSystem.doScriptProcessor
      for (let j = 0, N = outArray.length; j < N; j++) {
        //get a-rate parameter values for the current sample

        const tensenessMult = (params["tenseness-mult"][j] || params["tenseness-mult"][0]);
        //get final tenseness by multiplying base tenseness with multiplier for this sample
        this.UITenseness = params["tenseness"][0] * tensenessMult;
        this.loudness = Math.pow(tensenessMult * this.UITenseness, 0.25); // loudness is a function of speech tenseness
        
        this.intensity = params["intensity"][j] || params["intensity"][0];

        //get final pitch by applying
        this.UIFrequency = params["frequency"][0] * 
          Math.pow(2, (params['pitchbend'][j] || params['pitchbend'][0])/12);

        let lambda1 = j / N;
        let samp = this.runStep(lambda1, inputArray[j]);

        //apply panning multiplers to L and R channels
        outArray[j] = samp;
        noiseModArray[j] = this.getNoiseModulator();
      }
      this.finishBlock();

      return true;
    } catch (e) {
        console.error(`error from voice glottis #${this.voiceNum}:`, e);
      return true;
    }
  }
}

class TractProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      //tract length, in segments - horter tracts produce "younger", more "feminine" voices.
      {
        name: "n",
        defaultValue: 44,
        minValue: 30,
        maxValue: 60,
        automationRate: "k-rate"
      },
      //velum width, opens/closes the nasal tract, required for letters such as M and N
      {
        name: "velum-target",
        defaultValue: 0.01,
        minValue: 0,
        maxValue: 0.4,
        automationRate: "a-rate"
      },
      //horizontal location of constriction, in segment #, used to simulate a mouse held on the UI
      {
        name: "constriction-index",
        defaultValue: 0,
        minValue: 0,
        // maxValue: 44,
        automationRate: "a-rate"
      },
      //vertical location of constriction, used to simulate a mouse held on the UI
      {
        name: "constriction-diameter",
        defaultValue: 3,
        maxValue: 5,
        automationRate: "a-rate"
      },

      //index/diameter of a second tongue constriction
      {
        name: "constriction2-index",
        defaultValue: 0,
        minValue: 0,
        // maxValue: 44,
        automationRate: "a-rate"
      },
      {
        name: "constriction2-diameter",
        defaultValue: 3,
        maxValue: 5,
        automationRate: "a-rate"
      },

      {
        name: "lip-diameter",
        defaultValue: 1.5,
        minValue: 0,
        maxValue: 1.5
      },
      //tract movement speed, determines how fast tract diameters approach their targets. Set to -1 for instant.
      {
        name: "movement-speed",
        defaultValue: 15,
        automationRate: "k-rate"
      },
      //volume of fricative white noise produced by tight constrictions.
      {
        name: "fricative-strength",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate"
      },
      //tongue index + diameter - simulated horizontal + vertical position of tongue in GUI
      {
        name: "tongue-index",
        defaultValue: 12.9,
        minValue: 0,
        maxValue: 44,
        automationRate: "k-rate" 
      },    
      {
        name: "tongue-diameter",
        defaultValue: 2.43,
        minValue: 2.05,
        maxValue: 3.50,
        automationRate: "k-rate" 
      },  
    ];
  }

  //code below taken from original Pink Trombone Tract object

  n = 44;
  bladeStart = 10;
  tipStart = 32;
  lipStart = 39;
  R = []; //component going right
  L = []; //component going left
  reflection = [];
  junctionOutputR = [];
  junctionOutputL = [];
  diameter = [];
  targetDiameter = [];
  A = [];
  glottalReflection = 0.75;
  lipReflection = -0.85;
  lastObstruction = -1;
  fade = 1.0; //0.9999
  movementSpeed = 15; //cm per second
  transients = [];
  transientStrength = 0.3;
  lipOutput = 0;
  noseOutput = 0;
  velumTarget = 0.01;
  fricative_strength = 1;

  //Tract used to reference AudioSystem.blockTime, impossible from WorkletProcessor scope
  //so we calculate it here instead using <outputBufferLength>/sampleRate.
  blockTime = 128 / sampleRate; 

  constrictionIndex = 0;
  constrictionDiameter = 3;
  constriction2Index = 0;
  constriction2Diameter = 3;

  tongueIndex = 12.9;
  tongueDiameter = 2.43;

  lipDiameter = 5;

  constructor(options) {
    super();

    this.i = options.processorOptions.i;

    this.init();
  }

  init(n = 44) {

    this.n = n;
    this.bladeStart = Math.floor(10 * this.n/44);
    this.tipStart = Math.floor(32 * this.n/44);
    this.lipStart = Math.floor(39 *this.n/44);    

    this.diameter = new Float64Array(this.n);
    this.targetDiameter = new Float64Array(this.n);

    this.getTargetDiameters();
    for (let i = 0; i < this.targetDiameter.length; i++) this.diameter[i] = this.targetDiameter[i];
    
    this.R = new Float64Array(this.n);
    this.L = new Float64Array(this.n);
    this.reflection = new Float64Array(this.n+1);
    this.newReflection = new Float64Array(this.n+1);
    this.junctionOutputR = new Float64Array(this.n+1);
    this.junctionOutputL = new Float64Array(this.n+1);
    this.A =new Float64Array(this.n);

    this.noseLength = Math.floor(28 * this.n / 44)
    this.noseStart = this.n-this.noseLength + 1;
    this.noseR = new Float64Array(this.noseLength);
    this.noseL = new Float64Array(this.noseLength);
    this.noseJunctionOutputR = new Float64Array(this.noseLength+1);
    this.noseJunctionOutputL = new Float64Array(this.noseLength+1);        
    this.noseReflection = new Float64Array(this.noseLength+1);
    this.noseDiameter = new Float64Array(this.noseLength);
    this.noseA = new Float64Array(this.noseLength);
    for (let i = 0; i < this.noseLength; i++)
    {
        let diameter;
        let d = 2 * (i / this.noseLength);
        if (d < 1) diameter = 0.4 + 1.6 * d;
        else diameter = 0.5 + 1.5 * (2 - d);
        diameter = Math.min(diameter, 1.9);
        this.noseDiameter[i] = diameter;
    }       
    this.newReflectionLeft = this.newReflectionRight = this.newReflectionNose = 0;
    this.calculateReflections();        
    this.calculateNoseReflections();
    this.noseDiameter[0] = this.velumTarget;

    this.port.postMessage({d: this.diameter, v: this.noseDiameter[0]});
  }

  calculateReflections()
    {
      for (let i = 0; i < this.n; i++) 
      {
          this.A[i] = this.diameter[i] * this.diameter[i]; //ignoring PI etc.
      }
      for (let i = 1; i < this.n; i++)
      {
          this.reflection[i] = this.newReflection[i];
          if (this.A[i] == 0) this.newReflection[i] = 0.999; //to prevent some bad behaviour if 0
          else this.newReflection[i] = (this.A[i-1]-this.A[i]) / (this.A[i-1]+this.A[i]); 
      }
      
      this.reflectionLeft = this.newReflectionLeft;
      this.reflectionRight = this.newReflectionRight;
      this.reflectionNose = this.newReflectionNose;
      var sum = this.A[this.noseStart]+this.A[this.noseStart+1]+this.noseA[0];
      this.newReflectionLeft = (2*this.A[this.noseStart]-sum)/sum;
      this.newReflectionRight = (2*this.A[this.noseStart+1]-sum)/sum;   
      this.newReflectionNose = (2*this.noseA[0]-sum)/sum;      
  }

  calculateNoseReflections()
  {
    for (let i = 0; i < this.noseLength; i++) 
    {
      this.noseA[i] = this.noseDiameter[i] * this.noseDiameter[i]; 
    }
    for (let i = 1; i < this.noseLength; i++)
    {
      this.noseReflection[i] = (this.noseA[i-1] - this.noseA[i]) / (this.noseA[i-1] + this.noseA[i]); 
    }
  }

  reshapeTract(deltaTime) {
    let amount = this.movementSpeed < 0 ? Infinity : deltaTime * this.movementSpeed;
    let newLastObstruction = -1;
    for (let i = 0; i < this.n; i++) {
      let diameter = this.diameter[i];
      let targetDiameter = this.targetDiameter[i];
      if (diameter <= 0) newLastObstruction = i;
      let slowReturn; 
      if (i < this.noseStart) slowReturn = 0.6;
      else if (i >= this.tipStart) slowReturn = 1.0; 
      else slowReturn = 0.6 + 0.4 * (i - this.noseStart) / (this.tipStart - this.noseStart);
      this.diameter[i] = moveTowards(diameter, targetDiameter, slowReturn * amount, 2 * amount);
    }
    if (this.lastObstruction > -1 && newLastObstruction == -1 && this.noseA[0] < 0.05 && this.fricative_strength) {
      this.addTransient(this.lastObstruction);
    }
    this.lastObstruction = newLastObstruction;
    this.noseDiameter[0] = moveTowards(this.noseDiameter[0], this.velumTarget, amount*0.25, amount*0.1);
    this.noseA[0] = this.noseDiameter[0] * this.noseDiameter[0];        
  }

  addTransient(position)
  {
    let trans = {}
    trans.position = position;
    trans.timeAlive = 0;
    trans.lifeTime = 0.2;
    trans.strength = this.transientStrength;
    trans.exponent = 200; 
    this.transients.push(trans);
  }

  processTransients() {
    for (let i = 0; i < this.transients.length; i++)  
    {
      let trans = this.transients[i];
      let amplitude = trans.strength * Math.pow(2, -trans.exponent * trans.timeAlive);
      this.R[trans.position] += amplitude / 2;
      this.L[trans.position] += amplitude / 2;
      trans.timeAlive += 1.0 / (sampleRate * 2);
    }
    for (let i = this.transients.length - 1; i >= 0; i--)
    {
      let trans = this.transients[i];
      if (trans.timeAlive > trans.lifeTime) {
        this.transients.splice(i,1);
      }
    }
  }

  addTurbulenceNoise(turbulenceNoise, noiseModulator) {

    if (this.constrictionIndex < 2 || this.constrictionIndex > this.n) return;
    if (this.constrictionDiameter <= 0) return;     

    let intensity = this.fricative_strength * 2;
    this.addTurbulenceNoiseAtIndex(0.66 * turbulenceNoise * intensity, this.constrictionIndex, this.constrictionDiameter, noiseModulator);
    this.addTurbulenceNoiseAtIndex(0.66 * turbulenceNoise * intensity, this.constriction2Index, this.constriction2Diameter, noiseModulator);
  }

  addTurbulenceNoiseAtIndex(turbulenceNoise, index, diameter, noiseModulator) {   
    let i = Math.floor(index);
    let delta = index - i;

    turbulenceNoise *= noiseModulator;

    let thinness0 = clamp(8 * (0.7 - diameter), 0, 1);
    let openness = clamp(30 * (diameter-0.3), 0, 1);
    let noise0 = turbulenceNoise * (1 - delta) * thinness0 * openness;
    let noise1 = turbulenceNoise * delta * thinness0 * openness;

    this.R[i+1] += noise0/2;
    this.L[i+1] += noise0/2;
    this.R[i+2] += noise1/2;
    this.L[i+2] += noise1/2;
  }

  runStep(glottalOutput, turbulenceNoise, lambda, noiseModulator) {

    //mouth
    this.processTransients();
    this.addTurbulenceNoise(turbulenceNoise, noiseModulator);
    
    //this.glottalReflection = -0.8 + 1.6 * Glottis.newTenseness;
    this.junctionOutputR[0] = this.L[0] * this.glottalReflection + glottalOutput;
    this.junctionOutputL[this.n] = this.R[this.n - 1] * this.lipReflection; 
    
    for (let i = 1; i < this.n; i++) {
      let r = this.reflection[i] * (1-lambda) + this.newReflection[i] * lambda;
      let w = r * (this.R[i-1] + this.L[i]);
      this.junctionOutputR[i] = this.R[i-1] - w;
      this.junctionOutputL[i] = this.L[i] + w;
    }    
    
    //now at junction with nose
    let i = this.noseStart;
    let r = this.newReflectionLeft * (1 - lambda) + this.reflectionLeft * lambda;
    this.junctionOutputL[i] = r * this.R[i - 1] + (1 + r) * (this.noseL[0] + this.L[i]);
    r = this.newReflectionRight * (1-lambda) + this.reflectionRight * lambda;
    this.junctionOutputR[i] = r * this.L[i] + (1 + r) * (this.R[i - 1] + this.noseL[0]);     
    r = this.newReflectionNose * (1-lambda) + this.reflectionNose * lambda;
    this.noseJunctionOutputR[0] = r * this.noseL[0] + (1 + r) * (this.L[i] + this.R[i - 1]);
      
    for (let i = 0; i < this.n; i++)
    {          
      this.R[i] = this.junctionOutputR[i] * 0.999;
      this.L[i] = this.junctionOutputL[i+1] * 0.999; 
      
      //this.R[i] = Math.clamp(this.junctionOutputR[i] * this.fade, -1, 1);
      //this.L[i] = Math.clamp(this.junctionOutputL[i+1] * this.fade, -1, 1);    
    }

    this.lipOutput = this.R[this.n - 1];
    
    //nose     
    this.noseJunctionOutputL[this.noseLength] = this.noseR[this.noseLength-1] * this.lipReflection; 
    
    for (let i = 1; i < this.noseLength; i++) {
      let w = this.noseReflection[i] * (this.noseR[i-1] + this.noseL[i]);
      this.noseJunctionOutputR[i] = this.noseR[i-1] - w;
      this.noseJunctionOutputL[i] = this.noseL[i] + w;
    }
    
    for (let i = 0; i < this.noseLength; i++) {
      this.noseR[i] = this.noseJunctionOutputR[i] * this.fade;
      this.noseL[i] = this.noseJunctionOutputL[i+1] * this.fade;      
    }
    this.noseOutput = this.noseR[this.noseLength-1];
  }

  finishBlock() {         
    this.reshapeTract(this.blockTime);
    this.calculateReflections();
  }

  getTargetDiameters() {

    try {

      for (var i=0; i<this.n; i++) {
        var diameter = 0;
        if (i<7*this.n/44-0.5) diameter = 0.6;
        else if (i<12*this.n/44) diameter = 1.1;
        else diameter = 1.5;
        this.targetDiameter[i] = diameter;
      }

      //inscribe tongue position
      for (var i = this.bladeStart; i < this.lipStart; i++) {
        var t = 1.1 * Math.PI*(this.tongueIndex - i)/(this.tipStart - this.bladeStart);
        var fixedTongueDiameter = 2+(this.tongueDiameter-2)/1.5;
        var curve = (1.5-fixedTongueDiameter + 1.7)*Math.cos(t);
        if (i == this.bladeStart-2 || i == this.lipStart-1) curve *= 0.8;
        if (i == this.bladeStart || i == this.lipStart-2) curve *= 0.94;               
        this.targetDiameter[i] = 1.5 - curve;
      }

      //inscribe tongue constriction
      let index = this.constrictionIndex;
      let dia = this.constrictionDiameter;

      if (index && (dia > -1.6)) {
      
        if (index > this.noseStart && dia < -0.8) this.velumTarget = 0.4;
        dia -= 0.3;
        if (dia < 0) dia = 0;     
        
        let width = map(index, 25/44*this.n, this.tipStart, 10, 5)/44*this.n;

        if (index >= 2 && index < this.n && dia < 3) {

          let intIndex = Math.round(index);
          for (let i=-Math.ceil(width)-1; i<width+1; i++) {   
            if (intIndex+i<0 || intIndex+i >= this.n) continue;
            let relpos = (intIndex+i) - index;
            relpos = Math.abs(relpos)-0.5;
            let shrink;
            if (relpos <= 0) shrink = 0;
            else if (relpos > width) shrink = 1;
            else shrink = 0.5 * (1-Math.cos(Math.PI * relpos / width)); //0.5 * ...
            if (dia < this.targetDiameter[intIndex+i]) {
              this.targetDiameter[intIndex+i] = dia + (this.targetDiameter[intIndex+i]-dia)*shrink;
            }
          }
        }

      }

      //inscribe tongue constriction
      let index2 = this.constriction2Index;
      let dia2 = this.constriction2Diameter;

      if (index2 && (dia2 > -1.6)) {
      
        if (index2 > this.noseStart && dia2 < -0.8) this.velumTarget = 0.4;
        dia2 -= 0.3;
        if (dia2 < 0) dia2 = 0;     
        
        let width2 = map(index2, 25/44*this.n, this.tipStart, 10, 5)/44*this.n;

        if (index2 >= 2 && index2 < this.n && dia2 < 3) {

          let intIndex = Math.round(index2);
          for (let i=-Math.ceil(width2)-1; i<width2+1; i++) {   
            if (intIndex+i<0 || intIndex+i >= this.n) continue;
            let relpos = (intIndex+i) - index2;
            relpos = Math.abs(relpos)-0.5;
            let shrink;
            if (relpos <= 0) shrink = 0;
            else if (relpos > width2) shrink = 1;
            else shrink = 0.5 * (1-Math.cos(Math.PI * relpos / width2));
            if (dia2 < this.targetDiameter[intIndex+i]) {
              this.targetDiameter[intIndex+i] = dia2 + (this.targetDiameter[intIndex+i]-dia2)*shrink;
            }
          }
        }
      }

      //inscribe lip constriction
      let lIndex = this.n - 2;
      let lDia = this.lipDiameter;
      let lWidth = 5;

      var intIndex = Math.round(lIndex);
      for (var i=-Math.ceil(lWidth)-1; i<lWidth+1; i++) {   
        if (intIndex+i<0 || intIndex+i >= this.n) continue;
        var relpos = (intIndex+i) - lIndex;
        relpos = Math.abs(relpos)-0.5;
        var shrink;
        if (relpos <= 0) shrink = 0;
        else if (relpos > lWidth) shrink = 1;
        else shrink = 0.5 * (1-Math.cos(Math.PI * relpos / lWidth)); //0.5 * ...
        if (lDia < this.targetDiameter[intIndex+i]) {
          this.targetDiameter[intIndex+i] = lDia + (this.targetDiameter[intIndex+i]-lDia)*shrink;
        }
      }
    
    } catch (e) {console.log(e)}
  }
        
  process(inputs, outputs, params) {


    //some voices dont't have inputs defined immediately (why?)
    if (!inputs[0][0]) return true; //output nothing (silence) until they're ready


    let glottalSignal = inputs[0][0];
    let fricativeNoise = inputs[1][0];
    let noiseModArray = inputs[2][0];
    
    try {

      const newN = Math.floor(params['n'][0]);
      if (newN != this.n) {
        this.init(newN);
        console.log(`Voice #${this.i} new N: ${this.n}`);
      }
      
      //update a bunch of object properties using audioparam values
      this.velumTarget = params["velum-target"][0];

      this.constrictionIndex = params["constriction-index"][0];
      this.constrictionDiameter = params["constriction-diameter"][0] + 0.3;
      this.constriction2Index = params["constriction2-index"][0];
      this.constriction2Diameter = params["constriction2-diameter"][0] + 0.3;

      this.tongueIndex = params["tongue-index"][0]
      this.tongueDiameter = params["tongue-diameter"][0];

      this.lipDiameter = params["lip-diameter"][0];

      this.getTargetDiameters();

      this.movementSpeed = params["movement-speed"][0];
      this.fricative_strength = params["fricative-strength"][0];

      var outArrayL = outputs[0][0];
      var outArrayR = outputs[0][1];
      
      // var panMultR = (1 + params["pan"][0]) / 2;
      // var panMultL = 1 - panMultR;
      
      // var panMax = Math.max(panMultL, panMultR);
      // panMultR /= panMax;
      // panMultL /= panMax;
      
      for (let j = 0, N = outArrayL.length; j < N; j++) {
        
        let lambda1 = j / N;
        let lambda2 = (j + 0.5) / N;
        let glottalOutput = glottalSignal[j]
        
        let vocalOutput = 0;
        this.runStep(glottalOutput, fricativeNoise[j], lambda1, noiseModArray[j]);
        vocalOutput += this.lipOutput + this.noseOutput;
        
        this.runStep(glottalOutput, fricativeNoise[j], lambda2, noiseModArray[j]);
        vocalOutput += this.lipOutput + this.noseOutput;

        let samp = vocalOutput * 0.125;
        
        outArrayL[j] = samp 
          // * panMultL;
        outArrayR[j] = samp 
          // * panMultR;

      }
      
      this.finishBlock();
      
      //report current diameters and velum to main script
      this.port.postMessage({d: this.diameter, v: this.noseDiameter[0]});
      
    } catch (e) {
      console.error(`error from voice tract #${this.i}:`, e);
      return false;
    }
    return true;
  }

}

export function constrain(n, low, high) {
  return Math.max(Math.min(n, high), low);
};

export function map(n, start1, stop1, start2, stop2, withinBounds = true) {
  const newval = (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
  if (!withinBounds) {
      return newval;
  }
  if (start2 < stop2) {
      return constrain(newval, start2, stop2);
  } else {
      return constrain(newval, stop2, start2);
  }
};

registerProcessor("tract", TractProcessor);
registerProcessor("glottis", GlottisProcessor);