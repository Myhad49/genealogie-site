import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const dossierData = "./data";

function parcourirDossier(dossier) {
	const fichiers = fs.readdirSync(dossier);

	fichiers.forEach((fichier) => {
		const chemin = path.join(dossier, fichier);
		const stat = fs.statSync(chemin);

		if (stat.isDirectory()) {
			parcourirDossier(chemin);
		} else if (fichier.endsWith(".json")) {
			traiterFichier(chemin);
		}
	});
}

// 🔥 Fonction récursive (TRÈS IMPORTANT)
function remplacerUUID(obj) {
	let modifie = false;

	if (Array.isArray(obj)) {
		obj.forEach((item) => {
			if (remplacerUUID(item)) modifie = true;
		});
	} else if (typeof obj === "object" && obj !== null) {
		// 👉 Si UUID trouvé
		if (obj.uuid === "AUTO") {
			console.log("🎯 UUID trouvé !");
			obj.uuid = randomUUID();
			modifie = true;
		}

		// 👉 Parcours de toutes les clés
		for (let key in obj) {
			if (remplacerUUID(obj[key])) modifie = true;
		}
	}

	return modifie;
}

function traiterFichier(chemin) {
	let contenu = fs.readFileSync(chemin, "utf-8").trim();

	if (contenu === "") {
		console.log("⚪ JSON vide ignoré :", chemin);
		return;
	}

	let json;

	try {
		json = JSON.parse(contenu);
	} catch {
		console.log("⚠️ JSON invalide ignoré :", chemin);
		return;
	}

	console.log("🔍 Analyse :", chemin);

	const modifie = remplacerUUID(json);

	if (modifie) {
		fs.writeFileSync(chemin, JSON.stringify(json, null, 2));
		console.log("✅ UUID généré :", chemin);
	}
}

parcourirDossier(dossierData);