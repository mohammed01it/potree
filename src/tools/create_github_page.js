
const path = require('path');
const fs = require("fs");
const fsp = fs.promises;
const JSON5 = require('json5');

function toCode(files, data){
	if(!Array.isArray(data) || data.length === 0){
		return "<tr><td colspan=6 style=\"color:#888;font-style:italic\">No entries</td></tr>";
	}

	let code = "";

	try {
		let urls = data.map(e => e.url).filter(Boolean);
		let unhandled = [];
		for(const file of files){
			let isHandled = urls.some(url => file.includes(url));
			if(!isHandled){ unhandled.push(file); }
		}
		unhandled = unhandled
			.filter(file => file.endsWith(".html"))
			.filter(file => file !== "page.html");
	} catch(e){
		// ignore classification errors
	}

	const rows = [];
	let row = [];
	for(const example of data){
		row.push(example);
		if(row.length >= 6){
			rows.push(row);
			row = [];
		}
	}
	if(row.length > 0){ rows.push(row); }

	for(const row of rows){
		let thumbnails = "";
		let labels = "";
		for(const example of row){
			if(!example || !example.url){ continue; }
			let url = example.url.startsWith("http") ? example.url : `http://potree.org/potree/examples/${example.url}`;
			let thumb = example.thumb || "resources/logo_small.png";
			let label = example.label || example.url;
			thumbnails += `<td><a href="${url}" target="_blank"><img src="examples/${thumb}" width="100%" /></a></td>`;
			labels += `<th>${label}</th>`;
		}
		if(thumbnails){
			code += `<tr>${thumbnails}</tr><tr>${labels}</tr>`;
		}
	}

	return code || "<tr><td colspan=6 style=\"color:#888;font-style:italic\">No entries</td></tr>";
}


async function createGithubPage(){
	const content = await fsp.readFile("./examples/page.json", 'utf8');
	const settings = JSON5.parse(content);

	// تطبيع القيم المفقودة لتجنب أخطاء .map
	settings.examples = Array.isArray(settings.examples) ? settings.examples : [];
	settings.VR = Array.isArray(settings.VR) ? settings.VR : [];
	settings.showcase = Array.isArray(settings.showcase) ? settings.showcase : [];
	settings.thirdparty = Array.isArray(settings.thirdparty) ? settings.thirdparty : [];

	const files = await fsp.readdir("./examples");

	let unhandledCode = ``;

	let exampleCode = toCode(files, settings.examples);
	let vrCode = toCode(files, settings.VR);
	let showcaseCode = toCode(files, settings.showcase);
	let thirdpartyCode = toCode(files, settings.thirdparty);

	let page = `

		<h1>Examples</h1>

		<table>
			${exampleCode}
		</table>

		<h1>VR</h1>

		<table>
			${vrCode}
		</table>

		<h1>Showcase</h1>

		<table>
			${showcaseCode}
		</table>

		<h1>Third Party Showcase</h1>

		<table>
			${thirdpartyCode}
		</table>`;

	fs.writeFile(`examples/github.html`, page, (err) => {
		if(err){
			console.log(err);
		}else{
			console.log(`created examples/github.html`);
		}
	});
}




exports.createGithubPage = createGithubPage;