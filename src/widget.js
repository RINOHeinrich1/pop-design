import css from "./styles.css?inline";
import { defineReactTemplate } from "@onirtech/template-sdk/react";
import { Widget } from "./Widget.jsx";

defineReactTemplate("onirtech-widget-pop-design", Widget, { css });
