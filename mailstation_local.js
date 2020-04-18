var codeflashURL = 'codeflash.rom';
var dataflashURL = 'dataflash.rom';

//var codeflash = [];
//var dataflash = [];
var ram = [];

var keyrow;	// port 0x01
var port2;	// port 0x02
var mask_interrupt_src;	// port 0x03
var interrupt_src;	// port 0x03

var slot4000pg;	// port 0x05
var slot4000dv;	// port 0x06
var slot8000pg;	// port 0x07
var slot8000dv;	// port 0x08

var slot4000pg_offset
var slot8000pg_offset

var running;
var tstates = 0;
var interrupt_tstates = 0;
//var tstates_per_frame  = 69888;
//var tstates_per_interrupt  = 69888;

var tstates_per_frame;
var tstates_per_interrupt;


var CPU_Hz = 3500000;
var framerate_Hz = 60;
var frametime_ms = 16;

var framecount = 0;


/////////////////////////////// the debugger ////////////////////////////////
var status_text_obj;
var debugflag = false;
var breakpoint1 = new addr32(0, 0, 0, false);
var breakpoint2 = new addr32(0, 0, 0, false);
var onestep = false;

function init_debugger() {
	registers_obj = document.getElementById('registers');
	show_registers();
	setmhz(); // sets cpu speed from html field
}


function addr32(device, page, addr16, active) {
// This is an obj for holding a mailstation 32 bit address as 3 separate values: device; page; addr16;.
	this.device = device;
	this.page = page;
	this.addr16 = addr16;
	this.active = active;
	this.fromString = string2addr32; // parse string, and convert to numeric values
	this.fromAddr16 = addr16ToAddr32;//deduce num page and num device from numeric addr16
	this.toString = addr32ToString;  // convert numeric into string
}


function addr32ToString() {
	return(hx(this.device) + hx(this.page) + ':' + hxword(this.addr16));
}


function string2addr32(addr32str) { // parse string, and convert to numeric values
	var result;
	var a16str;
	// no semicolon in addr, or as 1st char, then treat as addr16, 
	// and get dv & page from bank regs,
	// otherwise, treat as addr32, and get dv & pg from string (before semi).
	
	// squash any whitespace
	var temp = addr32str.replace(/\s/g, '') ;
		
	// empty stings will convert to 0000:0000, marked "inactive".
	if (addr32str.match(/^$/)) {
		this.addr16 = 0;
		this.device = 0;
		this.page   = 0;
		this.active = false;
		//debuglog('nuttin');
		return;
	} 
	
	// find any semicolon
	var semi = temp.indexOf(':');
	
	if (semi > -1) {
		// there is a semicolon
		//debuglog('semi');
		a16str = ('0000' + temp.slice(semi+1,100)).slice(-4);
		devpagstr = '0000' + temp.slice(0, semi);
	} else if (temp.length < 5){
			//debuglog('no semi, less than 5 characters');
			a16str = ('0000' + temp).slice(-4);
			this.addr16 = parseInt(a16str, 16)
			// I know this is klugey...
			devpagstr = hx(getdevice(this.addr16)) + hx(getpage(this.addr16));
	} else {
			//debuglog('no semi, greater than 4 characters');
			a16str = temp.slice(-4);
			devpagstr = ('0000' + temp.substring(temp.length-8,temp.length-4)).slice(-4);
	}
	//debuglog('X' + devpagstr + 'X   X' + a16str + 'X');
	
	this.addr16 = parseInt(a16str, 16);
	this.device = parseInt(devpagstr.substr(0,2), 16);
	this.page   = parseInt(devpagstr.substr(2,2), 16);
	this.active = true;
}


// TODO  this is a perfect example of my difficulty with objects:  should this function be a part of the 
// addr32 object, or should it be a standalone function that can be called by addr32 & others?????
//
function addr16ToAddr32(a16) {   //deduce numeric page and numeric device from numeric addr16
}


function debuglog(message) {
	status_text_obj.value += message + '\n';
}


function setstatus(message) { // I got rid of status, just log it now.
	debuglog(message);
}


function hey(message) {
	debuglog(message);
	alert(message);
	onestep = true;
}


function show_registers() {
	registers_obj.innerHTML =  
			'PC: ' + hxdevicepage_word(z80.pc) + ' &nbsp &nbsp SP: ' + hxword(z80.sp) + 
	   ' &nbsp &nbsp IX: ' + hxdevicepage_word((z80.ixh << 8) + z80.ixl) +
	   ' &nbsp &nbsp IY: ' + hxdevicepage_word((z80.iyh << 8) + z80.iyl) + '<br><br>' +
		
			'BC: ' + hxdevicepage_word((z80.b << 8) + z80.c) + 
	   ' &nbsp &nbsp DE: ' + hxdevicepage_word((z80.d << 8) + z80.e) +
	   ' &nbsp &nbsp HL: ' + hxdevicepage_word((z80.h << 8) + z80.l) + showflags() + '<br>' +
		
	   'A:<input id="a" size="2" onkeyup="akeyup(event)" value="' + hx(z80.a) + '" />' +
	    ' &nbsp &nbsp F: ' + hx(z80.f) + 
	    ' &nbsp &nbsp B: ' + hx(z80.b) + ' &nbsp &nbsp C: ' + hx(z80.c) + 
	    ' &nbsp &nbsp D: ' + hx(z80.d) + ' &nbsp &nbsp E: ' + hx(z80.e) + 
	    ' &nbsp &nbsp H: ' + hx(z80.h) + ' &nbsp &nbsp L: ' + hx(z80.l) + '<br><br>' +
				
		      'A\': ' + hx(z80.a_) + ' &nbsp &nbsp F\':' + hx(z80.f_) + 
	 ' &nbsp &nbsp B\': ' + hx(z80.b_) + ' &nbsp &nbsp C\':' + hx(z80.c_) + 
	 ' &nbsp &nbsp D\': ' + hx(z80.d_) + ' &nbsp &nbsp E\':' + hx(z80.e_) + 
	 ' &nbsp &nbsp H\': ' + hx(z80.h_) + ' &nbsp &nbsp L\':' + hx(z80.l_) + '<br><br>' +
	 
	'TOS: ' + 
	hx(readbyte_internal((z80.sp) + 1 )) + hx(readbyte_internal((z80.sp) + 0)) + '&nbsp;&nbsp;' +
        hx(readbyte_internal((z80.sp) + 3 )) + hx(readbyte_internal((z80.sp) + 2)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) + 5 )) + hx(readbyte_internal((z80.sp) + 4)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) + 7 )) + hx(readbyte_internal((z80.sp) + 6)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) + 9 )) + hx(readbyte_internal((z80.sp) + 8)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +11 )) + hx(readbyte_internal((z80.sp) +10)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +13 )) + hx(readbyte_internal((z80.sp) +12)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +15 )) + hx(readbyte_internal((z80.sp) +14)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +17 )) + hx(readbyte_internal((z80.sp) +16)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +19 )) + hx(readbyte_internal((z80.sp) +18)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +21 )) + hx(readbyte_internal((z80.sp) +20)) + '&nbsp;&nbsp;' +
	hx(readbyte_internal((z80.sp) +23 )) + hx(readbyte_internal((z80.sp) +22)) + '<br><br>' +
	  
	//showports() + 
	showslots() + showtime();
}

///// below functions take numeric param, and return ascii hex strings

function hx(myval) {
	var temp = '0' + myval.toString(16);
	return(temp.substr(temp.length - 2, 2));
}


function hxword(val) {
	var temp = '000' + val.toString(16);
	return(temp.substr(temp.length - 4, 4));
}


function hxdevicepage_word(a16) {
// this is just used by showregisters.
	return(hxdevicepage(a16) + ':' + hxword(a16));
}


// only used by above?????????and below now????
function hxdevicepage(a16) {
	switch (a16 & 0xc000) {
		case 0x0000: return(hx(0) + hx(0));
		case 0x4000: return(hx(slot4000dv) + hx(slot4000pg));
		case 0x8000: return(hx(slot8000dv) + hx(slot8000pg));
		case 0xc000: return(hx(1) + hx(0));
	}
}


///////// These 2 functions below take numeric addr16 param, 
///////// and ret numeric device and page

function getdevice(a16) {     ///// this prolly could be converted into an array???????????
	switch (a16 & 0xc000) {
		case 0x0000: return(0);
		case 0x4000: return(slot4000dv);
		case 0x8000: return(slot8000dv);
		case 0xC000: return(1);
	}
}


function getpage(a16) {    /////this toooo?????
	switch (a16 & 0xc000) {
		case 0x0000: return(0);
		case 0x4000: return(slot4000pg);
		case 0x8000: return(slot8000pg);
		case 0xC000: return(0);
	}
}


function showflags() {
	return( ' &nbsp &nbsp ' + 	((z80.f & 0x80) ? 'S' : '_')  + 
					((z80.f & 0x40) ? 'Z' : '_') + 
					((z80.f & 0x10) ? 'H' : '_') + 
					((z80.f & 0x04) ? 'PV' : '__') + 
					((z80.f & 0x02) ? 'N' : '_') + 
					((z80.f & 0x01) ? 'C' : '_') );
}


//function showports() {
//}


///		[slot4000dv,slot4000pg,'4'],
///		[slot8000dv,slot8000pg,'8'],
///		[0,0,'4'],
///		[0,0,'8'],

function showslots() {
	////// TODO: make this array global, and use for the other functions, too.  
	//////Make into 3 separate arrays???????
	///////////  Or add columns for dev names, and "pg names" (pg name is just text rep of num).
	var slots = [ [         0,         0,'0'],
		      [slot4000dv,slot4000pg,'4'],
		      [slot8000dv,slot8000pg,'8'],
		      [1,       0,           'C']	];

	return(showslot(slots[0]) + '<br>' + showslot(slots[1]) + '<br>' + 
	      showslot(slots[2]) + '<br>' + showslot(slots[3])) + '<br>';
}


function showslot(slot) {
//var textdevicepage =   ['000 is codepage ' + hx(slot[1]),
//			'000 is rampage '  + hx(slot[1]),
//			'000 is leftLCD',
//			'000 is datapage ' + hx(slot[1]),
//			'000 is rightLCD',
//			'000 is modem'];
//	return( 'slot'+slot[2]+textdevicepage[slot[0]] );
////// i not sure above was a good idea after all.  
//// The switch was prolly faster than building that array 4 times????

		///TODO:  make 3 arrays:       slotnames,      devicenames, and pagenames
		///                               |||||            ||||||        |||||
		///                               VVVVV            VVVVVV        VVVVV
		switch (slot[0]) {
			case 0: return('slot ' + slot[2] + '000 is codepage ' + hx(slot[1]));
			case 1: return('slot ' + slot[2] + '000 is &nbsp;rampage '  + hx(slot[1]));
			case 2: return('slot ' + slot[2] + '000 is leftLCD');
			case 3: return('slot ' + slot[2] + '000 is datapage ' + hx(slot[1]));
			case 4: return('slot ' + slot[2] + '000 is rightLCD');
			case 5: return('slot ' + slot[2] + '000 is modem');
		}
}


function showtime() {
	return ('frame: ' + framecount + '<br>' +
		'tstates: ' + tstates + '<br>' +
		'running: ' + running + '<br>' 
	);
}

function atbreakpoint() {
	while (true) {
		if (!breakpoint1.active) break
		if (z80.pc != breakpoint1.addr16) break;
		if (getpage(z80.pc) != breakpoint1.page) break;	
		if (getdevice(z80.pc) != breakpoint1.device) break;
		return(1);
	}
	
	if (!breakpoint2.active)  return(0);
	if (z80.pc != breakpoint2.addr16) return(0);
	if (getpage(z80.pc) != breakpoint2.page) return(0);	
	if (getdevice(z80.pc) != breakpoint2.device) return(0);
	return(2);
}
	
			
function runtobp() {
	// First, we need to do a single step, 
	// in case bp is current inst (or add a "loop" button????
	stepinto();

	breakpoint1.fromString(document.getElementById('breakpoint1').value);
	breakpoint2.fromString(document.getElementById('breakpoint2').value);
	
	//debuglog('bp ' + hx(breakpoint.page) + '  ' +
	//		 hx(breakpoint.device) + '  ' +
	//		 hxword(breakpoint.addr16));
	
	// push expanded back to html (or just clear it????)
	//document.getElementById('breakpoint').value = breakpoint.toString();
	document.getElementById('breakpoint1').value = '';
	document.getElementById('breakpoint2').value = breakpoint2.toString();
	
	running = true; 
	if (breakpoint1.active) debuglog('breakpoint set at ' + breakpoint1.toString());
	if (breakpoint2.active) debuglog('breakpoint set at ' + breakpoint2.toString());
	var save_tstates_per_frame = tstates_per_frame;
	tstates_per_frame = 1;
	frame();
	tstates_per_frame = save_tstates_per_frame;
}


/////////////TODO:  create a breakpoint object, and a breakpoints object???
//////////////////  add a "match" method somewhere
//// maybe just a breakpoints obj, with a list of addr32's, and the match method!!
//// add a "on/off" for breakpoints

function bpkeyup(event) {
	// pressing enter in the bp field as good as clicking "run to bp" button.
	//debuglog('key in bp');
	if (event.keyCode == 13) runtobp();
}


function setmhz() {
	CPU_Hz       = parseInt(document.getElementById('mhz').value, 10);
	framerate_Hz = parseInt(document.getElementById('frmrate').value, 10);
	frametime_ms = Math.floor(1000 / framerate_Hz);
	tstates_per_frame  = Math.floor(CPU_Hz * frametime_ms / 1000);
	tstates_per_interrupt  = tstates_per_frame;	        
	debuglog('cpu clock: ' + CPU_Hz);
	debuglog('frametime_ms: ' + frametime_ms);
	debuglog('tstates per frame: ' + tstates_per_frame);
}


function mhzkeyup(event) {
	if (event.keyCode == 13) setmhz();
}


function seta() {
	var a = 0xFF & parseInt(document.getElementById('a').value, 16);
	document.getElementById('a').value = a.toString(16);
	debuglog('reg A set to: ' + CPU_Hz);
}


function akeyup(event) {
	if (event.keyCode == 13) seta();
}


function stepover() {
// do a single step, except for calls, do whole call in single step.
	debuglog('stepover');
	//debuglog('row: '+);
	showkeymatrix();
	//debuglog('leaving stepover');
}


function stepinto() {
	// do a single inst, for calls step into the call.
	breakpoint1.active = false;
	breakpoint2.active = false;
        running = true; 
        onestep = true;
	frame();
}
			
			
function start() {
        running = true; 
        setstatus('running');
	frame();
}
			
			
function stop() {
	setstatus('stopped');
	running = false;
}
			
			
function reset() {
	setstatus('reset');
	z80_reset();
	framecount = 0; //////////////// does this belong HERE???????
	dfwritelimit = 500;
	dfreadlimit = 700;
}


function xclear() {
	document.getElementById('debug_text').value = '';
}

////////////////////////// END OF DEBUGGER ///////////////////////////////////




/////////////////////// MAILSTATION EMULATOR ///////////////////////
var date;

function frame() {
	// This is literally the heart of the emulator!  "frame" executes 
	// approx 20 mSec worth of z80 code, (hopefully in much less than 
	// 20 mSec of real time), and then updates the LCD object in the html page.  
	// yada yada yada...
	// It then sets a timer to call "frame" again in 20 msec (real time).
	// "frame" then returns to the button-handler that started it going, 
	// and since that handler is now done
	// handling the "start" button event, it returns to the browser.
	// Note: The z80 clock, and number of T-states per frame are now configurable.

	
	framecount++;
	z80_do_opcodes();
	ctx.putImageData(imageData, 0, 0);
	show_registers();
	
	// Can't assume we did a whole frame, this insures interrupt doesn't happen
	// after every breakpoint.  
	// Perhaps not really necessary, if bp test below returns???
	if (tstates >=  tstates_per_frame) {
		interrupt_tstates += tstates;
		tstates -= tstates_per_frame;
	}
	
	// did we hit breakpoint?  Or end of frame?
	if ( atbreakpoint() || onestep ) {
		running = false;
		breakpoint1.active = false;
		breakpoint2.active = false;
		onestep = false;
		setstatus('bp ' + hxdevicepage_word(z80.pc)  + ' reached');
		show_registers();
		return;
	}
	
	if ( (interrupt_tstates + tstates) >= tstates_per_interrupt ) {
		interrupt_tstates -= tstates_per_interrupt;
		interrupt_src |= 0x02;
		z80_interrupt();
	}

	////if (running) setTimeout(frame, frametime_ms);
	if (running) setTimeout("frame()", 1);  
	
	//TODO: calc and display actual frames per second
}
			
			

function mailstation_init() {
	date = new Date();
	status_text_obj = document.getElementById('debug_text');

	//setstatus('loading codeflash');			                
	//load_codeflash();
	debuglog('size of codeflash: ' + codeflash.length);
	
	//setstatus('loading dataflash');			                
	load_dataflash();
	debuglog('size of dataflash: ' + dataflash.length);

	//setstatus('initializing ram');	
	for (var i = 0; i < 131072; i++) ram[i] = 0;
	debuglog('size of ram: ' + ram.length);
			        
	//setstatus('initializing z80');
	z80_init();
	setstatus('z80 ready');			        
	
	init_ports();	
	init_LCD();	
	init_keyboard();
	init_mouse();
	init_debugger();
}



///////////////////////////// MEMORY ///////////////////////////////////


// ********************* this is no longer needed with the yahoo hosted version. ********
function load_codeflash() {
       try {
		var req = new XMLHttpRequest();
		req.open('GET', codeflashURL, false);

		//XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com] 
		req.overrideMimeType('text/plain; charset=x-user-defined');
		req.send(null);
	}
	catch (err) {
		var stat = req.status;
		if (stat != 200) {
			setstatus('Cannot load codeflash ' + stat);
			throw new Error("Error: Cannot load codeflash");
		}
	}
	
	// THIS LINE MAKES IT RUN WAAAAY FASTER!!!!!!!
	var fileContents = req.responseText;
	
	var fileSize = fileContents.length;
	////this.readByteAt = function(i){
	////	return fileContents.charCodeAt(i) & 0xff;

	for (var i = 0x0000; i < fileSize - 1; i++) {
		// roms is an object, with a property "48.rom", whose value is a char string
		///////codeflash[i] = roms['48.rom'].charCodeAt(i);
		codeflash[i] = fileContents.charCodeAt(i) & 0xff;
	}
}


var testdfarray = [0xf8, 0x00, 0x7a, 0xc4, 0x7b, 0xc4, 0x30, 0x00];

function save_dataflash() {
	debuglog('Saving df image to localstorage....');
	
//	// convert df to array of hex strings, each string with 16 bytes representing
//	// a "row" of the df, with 32 hex chars in each row (no"0x", spaces, or commas).
//	var i = 0;
	var dflen = dataflash.length;
//	var hexrow;
//	var hexarray;
	debuglog('dflen: ' + dflen);
	
//	for (row = 0; row < 32768; row++) {
//		hexrow = '';
//		if (i>=dflen) break;
//		
//		for (j=0; j<16; j++) {
//			if (i>=dflen) break;
//			hexrow += hx(dataflash[i++]);
//		}
//		
//		hexarray[row] = hexrow;	
//	}
//	
//	var saveString = JSON.stringify(hexarray);
	
	
	var saveString = JSON.stringify(dataflash);
	debuglog(saveString.substr(0,100));
	localStorage.setItem('dataflashimage', saveString);
	
	//localStorage.setItem('dataflashimage', JSON.stringify(dataflash));
	debuglog('df saved.');
}


function delete_dataflash() {
	localStorage.removeItem('dataflashimage');
	debuglog('df image removed from localstorage.');
}


function load_dataflash() {
	//for (var i=0; i<524288; i++) dataflash[i] = 0;
	//return;


	// First let's see if we can load a saved df image from localstorage.
	var retrievedString = localStorage.getItem('dataflashimage');
	if ( retrievedString ) {
		/////debuglog('got a df image from localstorage: ' + retrievedString);
		debuglog('df size before: ' + dataflash.length );
		debuglog('got df image from localstorage! ' + retrievedString.length);
		dataflash = JSON.parse(retrievedString)
		debuglog('df size after: ' + dataflash.length );
		return;
	}

	return;


	debuglog('no data flash image retrived from localstorage, get one from server.');
	
	// If we could not load from localstorage, get default df image from server.
	try {
		var req = new XMLHttpRequest();
		req.open('GET', dataflashURL, false);

		//XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com] 
		req.overrideMimeType('text/plain; charset=x-user-defined');
		req.send(null);
	}
	catch (err) {
			setstatus('Cannot load dataflash '+req.status);			                
			throw new Error("Error: Cannot load dataflash");
	}
	var fileContents = req.responseText;
	debuglog('df length: ' + fileContents.length);
	for (var i = 0x0000; i < 0x80000; i++) {
		///////if (i<5) debuglog('' + i);
		dataflash[i] = fileContents.charCodeAt(i) & 0xff;
	}
}


var dfwritelimit = 100; // test aid, to limit log output!!!
var dfreadlimit = 100;

var df_state = 0;

function write_dataflash(addr, dfaddr, val) {
	//if (df_locked) return;
	
//	if (dfwritelimit) {
//		dfwritelimit--;
//		debuglog('wr: ' + addr.toString(16) +
//			 '  dfaddr: ' + dfaddr.toString(16) + 
//			 '  dfval: ' + hx(val));
//	}
				    
				    
	switch (df_state) {
		case 0: if (val == 0x10) df_state = 1; break;
			if (val == 0x20) df_state = 2; break;
		case 1: dataflash[dfaddr] = val; df_state = 0; break;
		case 2: df_state = 0; break; // no need 2 realy erase???
	}
				    
}


function read_dataflash(addr, dfaddr) {
	var offset = dfaddr & 0x3fff;
	
	// It occurs to me that I could just ignore the lock/unlock commands
//	switch (df_state) {
//		case 0: if (offset == 0x1823) df_state = 1; break;
//		case 1: if (offset == 0x1823) df_state = 2; break;
//		case 2: if (offset == 0x1823) df_state = 3; break;
//		case 3: if (offset == 0x1823) df_state = 4; break;
//		case 4: if (offset == 0x1823) df_state = 5; break;
//		case 5: if (offset == 0x1823) df_state = 6; break;
//		case 6: if (offset == 0x1823) df_state = 7; break;
//	}


//	if (dfreadlimit) {
//		if ((dfaddr & 0xfff00) == 0x20200) return(dataflash[dfaddr]);
//		dfreadlimit--;
//		debuglog('rd: ' + addr.toString(16) +
//			 '  dfaddr: ' + dfaddr.toString(16) + 
//			 '  dfval: ' + hx(dataflash[dfaddr]));
//	}

	return(dataflash[dfaddr]);
}


function readbyte_internal(addr) {
	var offset = addr & 0x3fff;

	switch (addr & 0xC000) {
		case (0x0000): return(codeflash[offset]);
		case (0x4000): switch (slot4000dv & 0x0f) {
			case 0x00: return(codeflash[offset + slot4000pg_offset]);	
			case 0x01: return(ram[offset + slot4000pg_offset]);
			case 0x02: return(readLCD(offset, 0));
			case 0x03: return(read_dataflash(addr, offset + slot4000pg_offset));
			case 0x04: return(readLCD(offset, 1));
			case 0x05: return(read_modem(offset));
			default:   return(0xff);
			}
		case (0x8000): switch (slot8000dv & 0x0f) {
			case 0x00: return(codeflash[offset + slot8000pg_offset]); 
			case 0x01: return(ram[offset + slot8000pg_offset]); 
			case 0x02: return(readLCD(offset, 0));
			case 0x03: return(read_dataflash(addr, offset + slot8000pg_offset));
			case 0x04: return(readLCD(offset, 1));				
			case 0x05: return(read_modem(offset));				
			default:   return(0xff);
			}
		case (0xC000): return(ram[offset]);  // rampage 0
	}
}


function writebyte_internal(addr, val) {
	var offset = addr & 0x3fff;

	switch (addr & 0xC000) {
		case (0x0000): return; // can't write codeflash (for now at least)
		case (0x4000): switch (slot4000dv & 0x0f) {
			case 0x00: return; // can't write codeflash (for now at least)
			case 0x01: ram[offset + slot4000pg_offset] = val; return;
			case 0x02: writeLCD(offset, 0, val); return;
			case 0x03: write_dataflash(addr, offset + slot4000pg_offset, val); return;
			case 0x04: writeLCD(offset, 1, val); return;
			case 0x05: return;
			default:   return;
			}
		case (0x8000): 	switch (slot8000dv & 0x0f) {
			case 0x00: return; // can't write codeflash (for now at least)
			case 0x01: //if (offset + slot8000pg_offset == 0) hey('writing ram addr 0');
				   ram[offset + slot8000pg_offset] = val; return;
			case 0x02: writeLCD(offset, 0, val); return;
			case 0x03: write_dataflash(addr, offset + slot8000pg_offset, val); return;
			case 0x04: writeLCD(offset, 1, val); return;
			case 0x05: return;
			default:   return;
			}
		case (0xC000):
			ram[offset] = val; return; // rampage 0
	}
}


///////////////////////// I/O PORTS /////////////////////////////////////

function init_ports() {
	writeport(0x01, 0);
	writeport(0x02, 0);
	writeport(0x03, 0);

	writeport(0x05, 0);
	writeport(0x06, 0);
	writeport(0x07, 0);
	writeport(0x08, 0);
}


function readport(addr) {
	switch (addr & 0xff) {
		case 0x01: return(readkeycolumn());
		case 0x02: return(port2);
		case 0x03: return(interrupt_src)
		case 0x05: return(slot4000pg);
		case 0x06: return(slot4000dv);
		case 0x07: return(slot8000pg);
		case 0x08: return(slot8000dv);
		case 0x09: return(0xe0);
		case 0x10:
		case 0x11:
		case 0x12:
		case 0x13:
		case 0x14:
		case 0x15:
		case 0x16:
		case 0x17:
		case 0x18:
		case 0x19:
		case 0x1a:
		case 0x1b:
		case 0x1c: return(get_time_port(addr & 0xff));
		default:   return(0x00);
	}
}


function writeport(addr, val) {
	switch (addr & 0xff) {
		case 0x01: keyrow = val; return;
		case 0x02: port2 = val;  return;
		case 0x03: mask_interrupt_src = val; return;
		case 0x05: slot4000pg = val; slot4000pg_offset = slot4000pg * 0x4000; return;	
		case 0x06: //if (val > 5) alert('hey, device is: ' + val.toString(16));
			   slot4000dv = val; return;		
		case 0x07: slot8000pg = val; slot8000pg_offset = slot8000pg * 0x4000; return; //break;		
		case 0x08: slot8000dv = val; return;		
	}
}


function get_time_port(port) {
	switch (port) {
	  case 0x10: return(             parseInt(date.getSeconds() ,10) % 10   );
	  case 0x11: return(  Math.floor(parseInt(date.getSeconds() ,10) / 10)  );
	  case 0x12: return(             parseInt(date.getMinutes() ,10) % 10   );
	  case 0x13: return(  Math.floor(parseInt(date.getMinutes() ,10) / 10)  );
	  case 0x14: return(             parseInt(date.getHours()   ,10) % 10   );
	  case 0x15: return(  Math.floor(parseInt(date.getHours()   ,10) / 10)  );
	  case 0x16: return(             parseInt(date.getDay()     ,10)        );
	  case 0x17: return(             parseInt(date.getDate()    ,10) % 10   );
	  case 0x18: return(  Math.floor(parseInt(date.getDate()    ,10) / 10)  );
	  case 0x19: return(             parseInt(date.getMonth()+1 ,10) % 10   );
	  case 0x1a: return(  Math.floor(parseInt(date.getMonth()+1 ,10) / 10)  );
	  case 0x1b: return(             parseInt(date.getFullYear()-1980,10) % 10   );
	  case 0x1c: return( (Math.floor(parseInt(date.getFullYear()-1980,10) / 10)) % 10 );
	}
}


///////////////////////// KEYBOARD /////////////////////////////////////////


var keymatrix = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

function init_keyboard() {
	debuglog('initing keyboard');
	document.onkeydown = keyDown;
	document.onkeyup = keyUp;
}


function readkeycolumn() {
	// row, col, & matrix are all active low.
	var column = 0xff; // start with all bits inactive.  ()
	
	// If keyrow active, then "and" that row from keymatrix with the result
	if ( !(keyrow & 0x01) ) column &= keymatrix[0];
	if ( !(keyrow & 0x02) ) column &= keymatrix[1];
	if ( !(keyrow & 0x04) ) column &= keymatrix[2];
	if ( !(keyrow & 0x08) ) column &= keymatrix[3];
	if ( !(keyrow & 0x10) ) column &= keymatrix[4];
	if ( !(keyrow & 0x20) ) column &= keymatrix[5];
	if ( !(keyrow & 0x40) ) column &= keymatrix[6];
	if ( !(keyrow & 0x80) ) column &= keymatrix[7];
	if ( !(port2  & 0x01) ) column &= keymatrix[8];
	if ( !(port2  & 0x02) ) column &= keymatrix[9];
	return(column);
}


// javascript keycodes mapped to mailstation keymatrix
var keyboardmap = {
	112: {row: 0, column: 0x01}, // f1 (main menu)
//	113: {row: 0, column: 0x02}, // f2 (back)
	 27: {row: 0, column: 0x02}, // esc (back)  esc seems more right for "back" key
	114: {row: 0, column: 0x04}, // f3 (print)
	115: {row: 0, column: 0x08}, // f4 (f1)
	116: {row: 0, column: 0x10}, // f5 (f2)
	117: {row: 0, column: 0x20}, // f6 (f3)
	118: {row: 0, column: 0x40}, // f7 (f4)
	119: {row: 0, column: 0x80}, // f8 (f5)
	120: {row: 1, column: 0x08}, // f9 (@)
	121: {row: 1, column: 0x10}, // f10 (size)
	122: {row: 1, column: 0x20}, // f11 (check spelling)
	123: {row: 1, column: 0x40}, // f12 (get email)
	 33: {row: 1, column: 0x80}, // pg up
	192: {row: 2, column: 0x01}, // backtick
	 49: {row: 2, column: 0x02}, // 1
	 50: {row: 2, column: 0x04}, // 2
	 51: {row: 2, column: 0x08}, // 3
	 52: {row: 2, column: 0x10}, // 4
	 53: {row: 2, column: 0x20}, // 5
	 54: {row: 2, column: 0x40}, // 6
	 55: {row: 2, column: 0x80}, // 7
	 56: {row: 3, column: 0x01}, // 8
	 57: {row: 3, column: 0x02}, // 9
	 48: {row: 3, column: 0x04}, // 0
	109: {row: 3, column: 0x08}, // -
	 61: {row: 3, column: 0x10}, // =
	  8: {row: 3, column: 0x20}, // del (backspace)
	191: {row: 3, column: 0x40}, // backslash
	 34: {row: 3, column: 0x80}, // pg dn
	  9: {row: 4, column: 0x01}, // tab
	 81: {row: 4, column: 0x02}, // Q
	 87: {row: 4, column: 0x04}, // W
	 69: {row: 4, column: 0x08}, // E
	 82: {row: 4, column: 0x10}, // R
	 84: {row: 4, column: 0x20}, // T
	 89: {row: 4, column: 0x40}, // Y
	 85: {row: 4, column: 0x80}, // U
	 73: {row: 5, column: 0x01}, // I
	 79: {row: 5, column: 0x02}, // O
	 80: {row: 5, column: 0x04}, // P
	219: {row: 5, column: 0x08}, // [
	221: {row: 5, column: 0x10}, // ]
	 59: {row: 5, column: 0x20}, // ;
	222: {row: 5, column: 0x40}, // '
	 13: {row: 5, column: 0x80}, // enter
	 20: {row: 6, column: 0x01}, // cap lock
	 65: {row: 6, column: 0x02}, // A
	 83: {row: 6, column: 0x04}, // S
	 68: {row: 6, column: 0x08}, // D
	 70: {row: 6, column: 0x10}, // F
	 71: {row: 6, column: 0x20}, // G
	 72: {row: 6, column: 0x40}, // H
	 74: {row: 6, column: 0x80}, // J
	 75: {row: 7, column: 0x01}, // K
	 76: {row: 7, column: 0x02}, // L
	188: {row: 7, column: 0x04}, // comma
	190: {row: 7, column: 0x08}, // .
	191: {row: 7, column: 0x10}, // /
	 38: {row: 7, column: 0x20}, // up arrow
	 40: {row: 7, column: 0x40}, // dn arrow
	 39: {row: 7, column: 0x80}, // rt arrow
	 16: {row: 8, column: 0x01}, // left shift
	 90: {row: 8, column: 0x02}, // Z
	 88: {row: 8, column: 0x04}, // X
	 67: {row: 8, column: 0x08}, // C
	 86: {row: 8, column: 0x10}, // V
	 66: {row: 8, column: 0x20}, // B
	 78: {row: 8, column: 0x40}, // N
	 77: {row: 8, column: 0x80}, // M
	 17: {row: 9, column: 0x01}, // ctrl
	 32: {row: 9, column: 0x08}, // space
//	 17: {row: 9, column: 0x40}, // right shift (javascript has just one shift code)
	 37: {row: 9, column: 0x80}, // lf arrow
};


function keyDown(evt) {
	var keyCode = keyboardmap[evt.keyCode];
	if (keyCode == null) {debuglog('scancode: '+evt.keyCode); return;}
	keymatrix[keyCode.row] &= ~(keyCode.column);
}


function keyUp(evt) {
	var keyCode = keyboardmap[evt.keyCode];
	if (keyCode == null) return;
	keymatrix[keyCode.row] |= keyCode.column;
}


function vnp() {
	debuglog('vnp clicked: ' + document.getElementById('test')[0].clicked);
	var keyCode;
	keyCode = keyboardmap[17];  // ctrl key
	keymatrix[keyCode.row] &= ~(keyCode.column);
	keyCode = keyboardmap[16];  // shift key
	keymatrix[keyCode.row] &= ~(keyCode.column);
	keyCode = keyboardmap[84];  // t key
	keymatrix[keyCode.row] &= ~(keyCode.column);
	debuglog('ctrl-shift-t are down');
	showkeymatrix();
}



function showkeymatrix() {
	debuglog('showkeymatrix');
	for (var i=0; i<10; i++) {
		debuglog('km[' + i + '] is: ' + keymatrix[i].toString(2) +
			 '   ' + ram[0x25f1].toString(2));
	}
}


////////////////// LCD /////////////////////////////


var canvas;
var ctx;
var imageData;
var imageDataData;

function init_LCD() {
	canvas = document.getElementById('screen');
	ctx = canvas.getContext('2d');
	ctx.fillStyle = 'black';
	//ctx.fillStyle = 'rgb(105,145,125)';
	ctx.fillRect(0,0,320,128); /* set alpha to opaque */
	imageData = ctx.getImageData(0,0,320,128);
	imageDataData = imageData.data;
}


var pixelcolumn;

function writeLCD(rowaddr, right, val) {
// each mailstation LCDwrite fills 8 LCD pixels, which need to be
// expanded to 24 bytes of color and 8 bytes alpha

	if ( !(port2 & 0x08) ) {
		// it is a column address  (0 thru 19)
		// column * 8 pix per col * 4 byte per pix
		pixelcolumn = (19 - val)  * 32;

		// offset to right half of LCD = 160 pix * 4 bytes per pix = 640
		if (right) pixelcolumn += 640;
		return;		
	}
	
	if (rowaddr < 56) return;
	if (rowaddr > 183) return;
	rowaddr = rowaddr - 56;
	
	var pixelAddress = (1280 * (rowaddr)) + pixelcolumn;
	
	for (var p = 0; p < 8; p++) {
		if (val & (1<<p)) {
			imageDataData[pixelAddress++] = 0x27; //foreground[0];
			imageDataData[pixelAddress++] = 0x1f; //foreground[1];
			imageDataData[pixelAddress++] = 0x96; //foreground[2];
			pixelAddress++;
		} else {
			imageDataData[pixelAddress++] = 0x69; //background[0];
			imageDataData[pixelAddress++] = 0x91; //background[1];
			imageDataData[pixelAddress++] = 0x7d; //background[2];
			pixelAddress++;
		}
	}
}


var canvasMinX;
var canvasMaxX;
var mouse_keyrow;
var mouse_keycol;

function canvasclicked(evt) {
  debuglog('canvas clicked');
  //////if ( !(evt.pageX > canvasMinX && evt.pageX < canvasMaxX) ) return; 
  
  // convert mouse to f-key scancode.  (scancode for first mousebutton is 115)
  var scancode = Math.floor((evt.pageX - canvasMinX) / 128) + 115;
  debuglog('scancode: ' + scancode);
  
  var keyCode = keyboardmap[scancode];
  if (keyCode == null) return;
  mouse_keyrow = keyCode.row;
  mouse_keycol = keyCode.column;

  // do keydown
  //debuglog('do keydown row: ' + keyCode.row + '   col: ' + keyCode.column);
  keymatrix[keyCode.row] &= ~(keyCode.column);

  // do keyup after short delay
  setTimeout("keymatrix[mouse_keyrow] |= mouse_keycol", 1000);
}


function init_mouse() {
  //////canvasMinX = $("#canvas").offset().left;
  canvasMinX = canvas.offsetLeft;
  canvasMaxX = canvasMinX + canvas.width;
  debuglog('canvas minx: ' + canvasMinX + '   max: ' + canvasMaxX);
}


//////////////////////////////////// modem //////////////////////////////

function read_modem(offset) {
	return(0);
}
