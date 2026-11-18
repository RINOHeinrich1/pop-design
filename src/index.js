// Entrée du template React : le CSS est importé comme chaîne (`?inline`) et
// injecté dans le Shadow DOM par le SDK. Le build Vite produit `dist/index.js`.
import css from "./styles.css?inline";
import { defineReactTemplate } from "@onirtech/template-sdk/react";
import { PopDesign } from "./PopDesign.jsx";

defineReactTemplate("onirtech-template-pop-design", PopDesign, { css });
