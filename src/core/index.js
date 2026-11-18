// API publique du socle générique (contrats, registres, entités, systèmes,
// stratégies, schémas de vue) — alignée sur la logique gestion_station:
// abstractions, fabriques, registres et UI pilotée par configuration.

export { Registry, RegistryHub } from "./registry.js";
export {
  IModel,
  IFieldDescriptor,
  IColumnDescriptor,
  IViewRenderer,
  IEntityService,
  IGenericComponent,
} from "./contracts.js";
export { Entity, VisualElement, TileModel, PanelModel, elementRegistry, registerElementModel, createElementModel } from "./element.js";
export { AssetResolver, assetResolver, BUNDLED, imageUrl, resolveLogo, resolveAvatar } from "./assets.js";
export { ChatSystem, chatSystem, normalizeChatConfig, normalizeMessages, parseSuggestions, shouldShowSuggestions, interpolate } from "./chat.js";
export { DesignSystem, designSystem, buildDesign, DESIGN_PRESETS } from "./design.js";
export { ParamSchema, paramSchema, PARAM_DEFINITIONS, DEFAULTS, paramValue, textParam, boolParam, parseJsonParam } from "./params.js";
export { TileSystem, tileSystem, normalizeTiles, createPanels, canonicalTileKind, canonicalIcon, findPanel, createFallbackMenu } from "./tiles.js";
export { ViewRegistry, viewRegistry, buildView } from "./view-registry.js";
export { UIComposer, uiComposer, createUiModel, hasCapability } from "./ui.js";
export { UiNode, ContainerNode, LeafNode, TextNode, SlotNode, UiNodeFactory, uiNodeFactory, n, box, leaf, textNode, when, list, createUiNode } from "./ui-node.js";
export { ComponentRegistry, componentRegistry, renderNode, GenericRenderer, registerBaseComponents } from "./ui-renderer.jsx";
export { InterfaceElement, Region, ViewModel, Layout, InterfaceBuilder, interfaceBuilder, buildAppInterface } from "./interface.js";
export { cx, StyleDescriptor, StyleRegistry, styleRegistry, createStyleDescriptor } from "./style.js";
