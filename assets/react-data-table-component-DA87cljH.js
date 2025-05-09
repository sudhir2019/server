import{r as n,R as m}from"./react-Oa8yNXwS.js";import{l as F,d as p,o as an}from"./styled-components-CDCIJ_e6.js";var Q;function ie(e,t){return e[t]}function ln(e=[],t,o=0){return[...e.slice(0,o),t,...e.slice(o)]}function rn(e=[],t,o="id"){const a=e.slice(),l=ie(t,o);return l?a.splice(a.findIndex(i=>ie(i,o)===l),1):a.splice(a.findIndex(i=>i===t),1),a}function ut(e){return e.map((t,o)=>{const a=Object.assign(Object.assign({},t),{sortable:t.sortable||!!t.sortFunction||void 0});return t.id||(a.id=o+1),a})}function pe(e,t){return Math.ceil(e/t)}function ze(e,t){return Math.min(e,t)}(function(e){e.ASC="asc",e.DESC="desc"})(Q||(Q={}));const k=()=>null;function yt(e,t=[],o=[]){let a={},l=[...o];return t.length&&t.forEach(i=>{if(!i.when||typeof i.when!="function")throw new Error('"when" must be defined in the conditional style object and must be function');i.when(e)&&(a=i.style||{},i.classNames&&(l=[...l,...i.classNames]),typeof i.style=="function"&&(a=i.style(e)||{}))}),{conditionalStyle:a,classNames:l.join(" ")}}function Ee(e,t=[],o="id"){const a=ie(e,o);return a?t.some(l=>ie(l,o)===a):t.some(l=>l===e)}function ve(e,t){return t?e.findIndex(o=>be(o.id,t)):-1}function be(e,t){return e==t}function sn(e,t){const o=!e.toggleOnSelectedRowsChange;switch(t.type){case"SELECT_ALL_ROWS":{const{keyField:a,rows:l,rowCount:i,mergeSelections:s}=t,g=!e.allSelected,b=!e.toggleOnSelectedRowsChange;if(s){const C=g?[...e.selectedRows,...l.filter(u=>!Ee(u,e.selectedRows,a))]:e.selectedRows.filter(u=>!Ee(u,l,a));return Object.assign(Object.assign({},e),{allSelected:g,selectedCount:C.length,selectedRows:C,toggleOnSelectedRowsChange:b})}return Object.assign(Object.assign({},e),{allSelected:g,selectedCount:g?i:0,selectedRows:g?l:[],toggleOnSelectedRowsChange:b})}case"SELECT_SINGLE_ROW":{const{keyField:a,row:l,isSelected:i,rowCount:s,singleSelect:g}=t;return g?i?Object.assign(Object.assign({},e),{selectedCount:0,allSelected:!1,selectedRows:[],toggleOnSelectedRowsChange:o}):Object.assign(Object.assign({},e),{selectedCount:1,allSelected:!1,selectedRows:[l],toggleOnSelectedRowsChange:o}):i?Object.assign(Object.assign({},e),{selectedCount:e.selectedRows.length>0?e.selectedRows.length-1:0,allSelected:!1,selectedRows:rn(e.selectedRows,l,a),toggleOnSelectedRowsChange:o}):Object.assign(Object.assign({},e),{selectedCount:e.selectedRows.length+1,allSelected:e.selectedRows.length+1===s,selectedRows:ln(e.selectedRows,l),toggleOnSelectedRowsChange:o})}case"SELECT_MULTIPLE_ROWS":{const{keyField:a,selectedRows:l,totalRows:i,mergeSelections:s}=t;if(s){const g=[...e.selectedRows,...l.filter(b=>!Ee(b,e.selectedRows,a))];return Object.assign(Object.assign({},e),{selectedCount:g.length,allSelected:!1,selectedRows:g,toggleOnSelectedRowsChange:o})}return Object.assign(Object.assign({},e),{selectedCount:l.length,allSelected:l.length===i,selectedRows:l,toggleOnSelectedRowsChange:o})}case"CLEAR_SELECTED_ROWS":{const{selectedRowsFlag:a}=t;return Object.assign(Object.assign({},e),{allSelected:!1,selectedCount:0,selectedRows:[],selectedRowsFlag:a})}case"SORT_CHANGE":{const{sortDirection:a,selectedColumn:l,clearSelectedOnSort:i}=t;return Object.assign(Object.assign(Object.assign({},e),{selectedColumn:l,sortDirection:a,currentPage:1}),i&&{allSelected:!1,selectedCount:0,selectedRows:[],toggleOnSelectedRowsChange:o})}case"CHANGE_PAGE":{const{page:a,paginationServer:l,visibleOnly:i,persistSelectedOnPageChange:s}=t,g=l&&s,b=l&&!s||i;return Object.assign(Object.assign(Object.assign(Object.assign({},e),{currentPage:a}),g&&{allSelected:!1}),b&&{allSelected:!1,selectedCount:0,selectedRows:[],toggleOnSelectedRowsChange:o})}case"CHANGE_ROWS_PER_PAGE":{const{rowsPerPage:a,page:l}=t;return Object.assign(Object.assign({},e),{currentPage:l,rowsPerPage:a})}}}const dn=F`
	pointer-events: none;
	opacity: 0.4;
`,cn=p.div`
	position: relative;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	max-width: 100%;
	${({disabled:e})=>e&&dn};
	${({theme:e})=>e.table.style};
`,gn=F`
	position: sticky;
	position: -webkit-sticky; /* Safari */
	top: 0;
	z-index: 1;
`,un=p.div`
	display: flex;
	width: 100%;
	${({$fixedHeader:e})=>e&&gn};
	${({theme:e})=>e.head.style};
`,pn=p.div`
	display: flex;
	align-items: stretch;
	width: 100%;
	${({theme:e})=>e.headRow.style};
	${({$dense:e,theme:t})=>e&&t.headRow.denseStyle};
`,Rt=(e,...t)=>F`
		@media screen and (max-width: ${599}px) {
			${F(e,...t)}
		}
	`,bn=(e,...t)=>F`
		@media screen and (max-width: ${959}px) {
			${F(e,...t)}
		}
	`,mn=(e,...t)=>F`
		@media screen and (max-width: ${1280}px) {
			${F(e,...t)}
		}
	`,hn=e=>(t,...o)=>F`
			@media screen and (max-width: ${e}px) {
				${F(t,...o)}
			}
		`,de=p.div`
	position: relative;
	display: flex;
	align-items: center;
	box-sizing: border-box;
	line-height: normal;
	${({theme:e,$headCell:t})=>e[t?"headCells":"cells"].style};
	${({$noPadding:e})=>e&&"padding: 0"};
`,vt=p(de)`
	flex-grow: ${({button:e,grow:t})=>t===0||e?0:t||1};
	flex-shrink: 0;
	flex-basis: 0;
	max-width: ${({maxWidth:e})=>e||"100%"};
	min-width: ${({minWidth:e})=>e||"100px"};
	${({width:e})=>e&&F`
			min-width: ${e};
			max-width: ${e};
		`};
	${({right:e})=>e&&"justify-content: flex-end"};
	${({button:e,center:t})=>(t||e)&&"justify-content: center"};
	${({compact:e,button:t})=>(e||t)&&"padding: 0"};

	/* handle hiding cells */
	${({hide:e})=>e&&e==="sm"&&Rt`
    display: none;
  `};
	${({hide:e})=>e&&e==="md"&&bn`
    display: none;
  `};
	${({hide:e})=>e&&e==="lg"&&mn`
    display: none;
  `};
	${({hide:e})=>e&&Number.isInteger(e)&&hn(e)`
    display: none;
  `};
`,fn=F`
	div:first-child {
		white-space: ${({$wrapCell:e})=>e?"normal":"nowrap"};
		overflow: ${({$allowOverflow:e})=>e?"visible":"hidden"};
		text-overflow: ellipsis;
	}
`,wn=p(vt).attrs(e=>({style:e.style}))`
	${({$renderAsCell:e})=>!e&&fn};
	${({theme:e,$isDragging:t})=>t&&e.cells.draggingStyle};
	${({$cellStyle:e})=>e};
`;var xn=n.memo(function({id:e,column:t,row:o,rowIndex:a,dataTag:l,isDragging:i,onDragStart:s,onDragOver:g,onDragEnd:b,onDragEnter:C,onDragLeave:u}){const{conditionalStyle:h,classNames:j}=yt(o,t.conditionalCellStyles,["rdt_TableCell"]);return n.createElement(wn,{id:e,"data-column-id":t.id,role:"cell",className:j,"data-tag":l,$cellStyle:t.style,$renderAsCell:!!t.cell,$allowOverflow:t.allowOverflow,button:t.button,center:t.center,compact:t.compact,grow:t.grow,hide:t.hide,maxWidth:t.maxWidth,minWidth:t.minWidth,right:t.right,width:t.width,$wrapCell:t.wrap,style:h,$isDragging:i,onDragStart:s,onDragOver:g,onDragEnd:b,onDragEnter:C,onDragLeave:u},!t.cell&&n.createElement("div",{"data-tag":l},function(R,S,D,w){return S?D&&typeof D=="function"?D(R,w):S(R,w):null}(o,t.selector,t.format,a)),t.cell&&t.cell(o,a,t,e))});const pt="input";var St=n.memo(function({name:e,component:t=pt,componentOptions:o={style:{}},indeterminate:a=!1,checked:l=!1,disabled:i=!1,onClick:s=k}){const g=t,b=g!==pt?o.style:(u=>Object.assign(Object.assign({fontSize:"18px"},!u&&{cursor:"pointer"}),{padding:0,marginTop:"1px",verticalAlign:"middle",position:"relative"}))(i),C=n.useMemo(()=>function(u,...h){let j;return Object.keys(u).map(R=>u[R]).forEach((R,S)=>{typeof R=="function"&&(j=Object.assign(Object.assign({},u),{[Object.keys(u)[S]]:R(...h)}))}),j||u}(o,a),[o,a]);return n.createElement(g,Object.assign({type:"checkbox",ref:u=>{u&&(u.indeterminate=a)},style:b,onClick:i?k:s,name:e,"aria-label":e,checked:l,disabled:i},C,{onChange:k}))});const Cn=p(de)`
	flex: 0 0 48px;
	min-width: 48px;
	justify-content: center;
	align-items: center;
	user-select: none;
	white-space: nowrap;
`;function yn({name:e,keyField:t,row:o,rowCount:a,selected:l,selectableRowsComponent:i,selectableRowsComponentProps:s,selectableRowsSingle:g,selectableRowDisabled:b,onSelectedRow:C}){const u=!(!b||!b(o));return n.createElement(Cn,{onClick:h=>h.stopPropagation(),className:"rdt_TableCell",$noPadding:!0},n.createElement(St,{name:e,component:i,componentOptions:s,checked:l,"aria-checked":l,onClick:()=>{C({type:"SELECT_SINGLE_ROW",row:o,isSelected:l,keyField:t,rowCount:a,singleSelect:g})},disabled:u}))}const Rn=p.button`
	display: inline-flex;
	align-items: center;
	user-select: none;
	white-space: nowrap;
	border: none;
	background-color: transparent;
	${({theme:e})=>e.expanderButton.style};
`;function vn({disabled:e=!1,expanded:t=!1,expandableIcon:o,id:a,row:l,onToggled:i}){const s=t?o.expanded:o.collapsed;return n.createElement(Rn,{"aria-disabled":e,onClick:()=>i&&i(l),"data-testid":`expander-button-${a}`,disabled:e,"aria-label":t?"Collapse Row":"Expand Row",role:"button",type:"button"},s)}const Sn=p(de)`
	white-space: nowrap;
	font-weight: 400;
	min-width: 48px;
	${({theme:e})=>e.expanderCell.style};
`;function En({row:e,expanded:t=!1,expandableIcon:o,id:a,onToggled:l,disabled:i=!1}){return n.createElement(Sn,{onClick:s=>s.stopPropagation(),$noPadding:!0},n.createElement(vn,{id:a,row:e,expanded:t,expandableIcon:o,disabled:i,onToggled:l}))}const On=p.div`
	width: 100%;
	box-sizing: border-box;
	${({theme:e})=>e.expanderRow.style};
	${({$extendedRowStyle:e})=>e};
`;var $n=n.memo(function({data:e,ExpanderComponent:t,expanderComponentProps:o,extendedRowStyle:a,extendedClassNames:l}){const i=["rdt_ExpanderRow",...l.split(" ").filter(s=>s!=="rdt_TableRow")].join(" ");return n.createElement(On,{className:i,$extendedRowStyle:a},n.createElement(t,Object.assign({data:e},o)))});const Ne="allowRowEvents";var Oe,We,bt;(function(e){e.LTR="ltr",e.RTL="rtl",e.AUTO="auto"})(Oe||(Oe={})),function(e){e.LEFT="left",e.RIGHT="right",e.CENTER="center"}(We||(We={})),function(e){e.SM="sm",e.MD="md",e.LG="lg"}(bt||(bt={}));const Pn=F`
	&:hover {
		${({$highlightOnHover:e,theme:t})=>e&&t.rows.highlightOnHoverStyle};
	}
`,kn=F`
	&:hover {
		cursor: pointer;
	}
`,Dn=p.div.attrs(e=>({style:e.style}))`
	display: flex;
	align-items: stretch;
	align-content: stretch;
	width: 100%;
	box-sizing: border-box;
	${({theme:e})=>e.rows.style};
	${({$dense:e,theme:t})=>e&&t.rows.denseStyle};
	${({$striped:e,theme:t})=>e&&t.rows.stripedStyle};
	${({$highlightOnHover:e})=>e&&Pn};
	${({$pointerOnHover:e})=>e&&kn};
	${({$selected:e,theme:t})=>e&&t.rows.selectedHighlightStyle};
	${({$conditionalStyle:e})=>e};
`;function Hn({columns:e=[],conditionalRowStyles:t=[],defaultExpanded:o=!1,defaultExpanderDisabled:a=!1,dense:l=!1,expandableIcon:i,expandableRows:s=!1,expandableRowsComponent:g,expandableRowsComponentProps:b,expandableRowsHideExpander:C,expandOnRowClicked:u=!1,expandOnRowDoubleClicked:h=!1,highlightOnHover:j=!1,id:R,expandableInheritConditionalStyles:S,keyField:D,onRowClicked:w=k,onRowDoubleClicked:$=k,onRowMouseEnter:H=k,onRowMouseLeave:v=k,onRowExpandToggled:E=k,onSelectedRow:L=k,pointerOnHover:M=!1,row:x,rowCount:y,rowIndex:V,selectableRowDisabled:A=null,selectableRows:N=!1,selectableRowsComponent:U,selectableRowsComponentProps:O,selectableRowsHighlight:te=!1,selectableRowsSingle:ce=!1,selected:ne,striped:oe=!1,draggingColumnId:$e,onDragStart:Pe,onDragOver:ke,onDragEnd:De,onDragEnter:B,onDragLeave:he}){const[G,fe]=n.useState(o);n.useEffect(()=>{fe(o)},[o]);const Z=n.useCallback(()=>{fe(!G),E(!G,x)},[G,E,x]),He=M||s&&(u||h),Fe=n.useCallback(P=>{P.target.getAttribute("data-tag")===Ne&&(w(x,P),!a&&s&&u&&Z())},[a,u,s,Z,w,x]),we=n.useCallback(P=>{P.target.getAttribute("data-tag")===Ne&&($(x,P),!a&&s&&h&&Z())},[a,h,s,Z,$,x]),je=n.useCallback(P=>{H(x,P)},[H,x]),X=n.useCallback(P=>{v(x,P)},[v,x]),J=ie(x,D),{conditionalStyle:xe,classNames:Ce}=yt(x,t,["rdt_TableRow"]),Ie=te&&ne,Te=S?xe:{},Le=oe&&V%2==0;return n.createElement(n.Fragment,null,n.createElement(Dn,{id:`row-${R}`,role:"row",$striped:Le,$highlightOnHover:j,$pointerOnHover:!a&&He,$dense:l,onClick:Fe,onDoubleClick:we,onMouseEnter:je,onMouseLeave:X,className:Ce,$selected:Ie,$conditionalStyle:xe},N&&n.createElement(yn,{name:`select-row-${J}`,keyField:D,row:x,rowCount:y,selected:ne,selectableRowsComponent:U,selectableRowsComponentProps:O,selectableRowDisabled:A,selectableRowsSingle:ce,onSelectedRow:L}),s&&!C&&n.createElement(En,{id:J,expandableIcon:i,expanded:G,row:x,onToggled:Z,disabled:a}),e.map(P=>P.omit?null:n.createElement(xn,{id:`cell-${P.id}-${J}`,key:`cell-${P.id}-${J}`,dataTag:P.ignoreRowClick||P.button?null:Ne,column:P,row:x,rowIndex:V,isDragging:be($e,P.id),onDragStart:Pe,onDragOver:ke,onDragEnd:De,onDragEnter:B,onDragLeave:he}))),s&&G&&n.createElement($n,{key:`expander-${J}`,data:x,extendedRowStyle:Te,extendedClassNames:Ce,ExpanderComponent:g,expanderComponentProps:b}))}const Fn=p.span`
	padding: 2px;
	color: inherit;
	flex-grow: 0;
	flex-shrink: 0;
	${({$sortActive:e})=>e?"opacity: 1":"opacity: 0"};
	${({$sortDirection:e})=>e==="desc"&&"transform: rotate(180deg)"};
`,jn=({sortActive:e,sortDirection:t})=>m.createElement(Fn,{$sortActive:e,$sortDirection:t},"▲"),In=p(vt)`
	${({button:e})=>e&&"text-align: center"};
	${({theme:e,$isDragging:t})=>t&&e.headCells.draggingStyle};
`,Tn=F`
	cursor: pointer;
	span.__rdt_custom_sort_icon__ {
		i,
		svg {
			transform: 'translate3d(0, 0, 0)';
			${({$sortActive:e})=>e?"opacity: 1":"opacity: 0"};
			color: inherit;
			font-size: 18px;
			height: 18px;
			width: 18px;
			backface-visibility: hidden;
			transform-style: preserve-3d;
			transition-duration: 95ms;
			transition-property: transform;
		}

		&.asc i,
		&.asc svg {
			transform: rotate(180deg);
		}
	}

	${({$sortActive:e})=>!e&&F`
			&:hover,
			&:focus {
				opacity: 0.7;

				span,
				span.__rdt_custom_sort_icon__ * {
					opacity: 0.7;
				}
			}
		`};
`,Ln=p.div`
	display: inline-flex;
	align-items: center;
	justify-content: inherit;
	height: 100%;
	width: 100%;
	outline: none;
	user-select: none;
	overflow: hidden;
	${({disabled:e})=>!e&&Tn};
`,Mn=p.div`
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
`;var An=n.memo(function({column:e,disabled:t,draggingColumnId:o,selectedColumn:a={},sortDirection:l,sortIcon:i,sortServer:s,pagination:g,paginationServer:b,persistSelectedOnSort:C,selectableRowsVisibleOnly:u,onSort:h,onDragStart:j,onDragOver:R,onDragEnd:S,onDragEnter:D,onDragLeave:w}){n.useEffect(()=>{typeof e.selector=="string"&&console.error(`Warning: ${e.selector} is a string based column selector which has been deprecated as of v7 and will be removed in v8. Instead, use a selector function e.g. row => row[field]...`)},[]);const[$,H]=n.useState(!1),v=n.useRef(null);if(n.useEffect(()=>{v.current&&H(v.current.scrollWidth>v.current.clientWidth)},[$]),e.omit)return null;const E=()=>{if(!e.sortable&&!e.selector)return;let O=l;be(a.id,e.id)&&(O=l===Q.ASC?Q.DESC:Q.ASC),h({type:"SORT_CHANGE",sortDirection:O,selectedColumn:e,clearSelectedOnSort:g&&b&&!C||s||u})},L=O=>n.createElement(jn,{sortActive:O,sortDirection:l}),M=()=>n.createElement("span",{className:[l,"__rdt_custom_sort_icon__"].join(" ")},i),x=!(!e.sortable||!be(a.id,e.id)),y=!e.sortable||t,V=e.sortable&&!i&&!e.right,A=e.sortable&&!i&&e.right,N=e.sortable&&i&&!e.right,U=e.sortable&&i&&e.right;return n.createElement(In,{"data-column-id":e.id,className:"rdt_TableCol",$headCell:!0,allowOverflow:e.allowOverflow,button:e.button,compact:e.compact,grow:e.grow,hide:e.hide,maxWidth:e.maxWidth,minWidth:e.minWidth,right:e.right,center:e.center,width:e.width,draggable:e.reorder,$isDragging:be(e.id,o),onDragStart:j,onDragOver:R,onDragEnd:S,onDragEnter:D,onDragLeave:w},e.name&&n.createElement(Ln,{"data-column-id":e.id,"data-sort-id":e.id,role:"columnheader",tabIndex:0,className:"rdt_TableCol_Sortable",onClick:y?void 0:E,onKeyPress:y?void 0:O=>{O.key==="Enter"&&E()},$sortActive:!y&&x,disabled:y},!y&&U&&M(),!y&&A&&L(x),typeof e.name=="string"?n.createElement(Mn,{title:$?e.name:void 0,ref:v,"data-column-id":e.id},e.name):e.name,!y&&N&&M(),!y&&V&&L(x)))});const _n=p(de)`
	flex: 0 0 48px;
	justify-content: center;
	align-items: center;
	user-select: none;
	white-space: nowrap;
	font-size: unset;
`;function zn({headCell:e=!0,rowData:t,keyField:o,allSelected:a,mergeSelections:l,selectedRows:i,selectableRowsComponent:s,selectableRowsComponentProps:g,selectableRowDisabled:b,onSelectAllRows:C}){const u=i.length>0&&!a,h=b?t.filter(S=>!b(S)):t,j=h.length===0,R=Math.min(t.length,h.length);return n.createElement(_n,{className:"rdt_TableCol",$headCell:e,$noPadding:!0},n.createElement(St,{name:"select-all-rows",component:s,componentOptions:g,onClick:()=>{C({type:"SELECT_ALL_ROWS",rows:h,rowCount:R,mergeSelections:l,keyField:o})},checked:a,indeterminate:u,disabled:j}))}function Et(e=Oe.AUTO){const t=typeof window=="object",[o,a]=n.useState(!1);return n.useEffect(()=>{if(t)if(e!=="auto")a(e==="rtl");else{const l=!(!window.document||!window.document.createElement),i=document.getElementsByTagName("BODY")[0],s=document.getElementsByTagName("HTML")[0],g=i.dir==="rtl"||s.dir==="rtl";a(l&&g)}},[e,t]),o}const Nn=p.div`
	display: flex;
	align-items: center;
	flex: 1 0 auto;
	height: 100%;
	color: ${({theme:e})=>e.contextMenu.fontColor};
	font-size: ${({theme:e})=>e.contextMenu.fontSize};
	font-weight: 400;
`,Wn=p.div`
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-wrap: wrap;
`,mt=p.div`
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	box-sizing: inherit;
	z-index: 1;
	align-items: center;
	justify-content: space-between;
	display: flex;
	${({$rtl:e})=>e&&"direction: rtl"};
	${({theme:e})=>e.contextMenu.style};
	${({theme:e,$visible:t})=>t&&e.contextMenu.activeStyle};
`;function Bn({contextMessage:e,contextActions:t,contextComponent:o,selectedCount:a,direction:l}){const i=Et(l),s=a>0;return o?n.createElement(mt,{$visible:s},n.cloneElement(o,{selectedCount:a})):n.createElement(mt,{$visible:s,$rtl:i},n.createElement(Nn,null,((g,b,C)=>{if(b===0)return null;const u=b===1?g.singular:g.plural;return C?`${b} ${g.message||""} ${u}`:`${b} ${u} ${g.message||""}`})(e,a,i)),n.createElement(Wn,null,t))}const Gn=p.div`
	position: relative;
	box-sizing: border-box;
	overflow: hidden;
	display: flex;
	flex: 1 1 auto;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	flex-wrap: wrap;
	${({theme:e})=>e.header.style}
`,Vn=p.div`
	flex: 1 0 auto;
	color: ${({theme:e})=>e.header.fontColor};
	font-size: ${({theme:e})=>e.header.fontSize};
	font-weight: 400;
`,Un=p.div`
	flex: 1 0 auto;
	display: flex;
	align-items: center;
	justify-content: flex-end;

	> * {
		margin-left: 5px;
	}
`,Xn=({title:e,actions:t=null,contextMessage:o,contextActions:a,contextComponent:l,selectedCount:i,direction:s,showMenu:g=!0})=>n.createElement(Gn,{className:"rdt_TableHeader",role:"heading","aria-level":1},n.createElement(Vn,null,e),t&&n.createElement(Un,null,t),g&&n.createElement(Bn,{contextMessage:o,contextActions:a,contextComponent:l,direction:s,selectedCount:i}));function Ot(e,t){var o={};for(var a in e)Object.prototype.hasOwnProperty.call(e,a)&&t.indexOf(a)<0&&(o[a]=e[a]);if(e!=null&&typeof Object.getOwnPropertySymbols=="function"){var l=0;for(a=Object.getOwnPropertySymbols(e);l<a.length;l++)t.indexOf(a[l])<0&&Object.prototype.propertyIsEnumerable.call(e,a[l])&&(o[a[l]]=e[a[l]])}return o}const Kn={left:"flex-start",right:"flex-end",center:"center"},Yn=p.header`
	position: relative;
	display: flex;
	flex: 1 1 auto;
	box-sizing: border-box;
	align-items: center;
	padding: 4px 16px 4px 24px;
	width: 100%;
	justify-content: ${({align:e})=>Kn[e]};
	flex-wrap: ${({$wrapContent:e})=>e?"wrap":"nowrap"};
	${({theme:e})=>e.subHeader.style}
`,Qn=e=>{var{align:t="right",wrapContent:o=!0}=e,a=Ot(e,["align","wrapContent"]);return n.createElement(Yn,Object.assign({align:t,$wrapContent:o},a))},Zn=p.div`
	display: flex;
	flex-direction: column;
`,Jn=p.div`
	position: relative;
	width: 100%;
	border-radius: inherit;
	${({$responsive:e,$fixedHeader:t})=>e&&F`
			overflow-x: auto;

			// hidden prevents vertical scrolling in firefox when fixedHeader is disabled
			overflow-y: ${t?"auto":"hidden"};
			min-height: 0;
		`};

	${({$fixedHeader:e=!1,$fixedHeaderScrollHeight:t="100vh"})=>e&&F`
			max-height: ${t};
			-webkit-overflow-scrolling: touch;
		`};

	${({theme:e})=>e.responsiveWrapper.style};
`,ht=p.div`
	position: relative;
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	${e=>e.theme.progress.style};
`,qn=p.div`
	position: relative;
	width: 100%;
	${({theme:e})=>e.tableWrapper.style};
`,eo=p(de)`
	white-space: nowrap;
	${({theme:e})=>e.expanderCell.style};
`,to=p.div`
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	${({theme:e})=>e.noData.style};
`,no=()=>m.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24"},m.createElement("path",{d:"M7 10l5 5 5-5z"}),m.createElement("path",{d:"M0 0h24v24H0z",fill:"none"})),oo=p.select`
	cursor: pointer;
	height: 24px;
	max-width: 100%;
	user-select: none;
	padding-left: 8px;
	padding-right: 24px;
	box-sizing: content-box;
	font-size: inherit;
	color: inherit;
	border: none;
	background-color: transparent;
	appearance: none;
	direction: ltr;
	flex-shrink: 0;

	&::-ms-expand {
		display: none;
	}

	&:disabled::-ms-expand {
		background: #f60;
	}

	option {
		color: initial;
	}
`,ao=p.div`
	position: relative;
	flex-shrink: 0;
	font-size: inherit;
	color: inherit;
	margin-top: 1px;

	svg {
		top: 0;
		right: 0;
		color: inherit;
		position: absolute;
		fill: currentColor;
		width: 24px;
		height: 24px;
		display: inline-block;
		user-select: none;
		pointer-events: none;
	}
`,lo=e=>{var{defaultValue:t,onChange:o}=e,a=Ot(e,["defaultValue","onChange"]);return n.createElement(ao,null,n.createElement(oo,Object.assign({onChange:o,defaultValue:t},a)),n.createElement(no,null))},r={columns:[],data:[],title:"",keyField:"id",selectableRows:!1,selectableRowsHighlight:!1,selectableRowsNoSelectAll:!1,selectableRowSelected:null,selectableRowDisabled:null,selectableRowsComponent:"input",selectableRowsComponentProps:{},selectableRowsVisibleOnly:!1,selectableRowsSingle:!1,clearSelectedRows:!1,expandableRows:!1,expandableRowDisabled:null,expandableRowExpanded:null,expandOnRowClicked:!1,expandableRowsHideExpander:!1,expandOnRowDoubleClicked:!1,expandableInheritConditionalStyles:!1,expandableRowsComponent:function(){return m.createElement("div",null,"To add an expander pass in a component instance via ",m.createElement("strong",null,"expandableRowsComponent"),". You can then access props.data from this component.")},expandableIcon:{collapsed:m.createElement(()=>m.createElement("svg",{fill:"currentColor",height:"24",viewBox:"0 0 24 24",width:"24",xmlns:"http://www.w3.org/2000/svg"},m.createElement("path",{d:"M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"}),m.createElement("path",{d:"M0-.25h24v24H0z",fill:"none"})),null),expanded:m.createElement(()=>m.createElement("svg",{fill:"currentColor",height:"24",viewBox:"0 0 24 24",width:"24",xmlns:"http://www.w3.org/2000/svg"},m.createElement("path",{d:"M7.41 7.84L12 12.42l4.59-4.58L18 9.25l-6 6-6-6z"}),m.createElement("path",{d:"M0-.75h24v24H0z",fill:"none"})),null)},expandableRowsComponentProps:{},progressPending:!1,progressComponent:m.createElement("div",{style:{fontSize:"24px",fontWeight:700,padding:"24px"}},"Loading..."),persistTableHead:!1,sortIcon:null,sortFunction:null,sortServer:!1,striped:!1,highlightOnHover:!1,pointerOnHover:!1,noContextMenu:!1,contextMessage:{singular:"item",plural:"items",message:"selected"},actions:null,contextActions:null,contextComponent:null,defaultSortFieldId:null,defaultSortAsc:!0,responsive:!0,noDataComponent:m.createElement("div",{style:{padding:"24px"}},"There are no records to display"),disabled:!1,noTableHead:!1,noHeader:!1,subHeader:!1,subHeaderAlign:We.RIGHT,subHeaderWrap:!0,subHeaderComponent:null,fixedHeader:!1,fixedHeaderScrollHeight:"100vh",pagination:!1,paginationServer:!1,paginationServerOptions:{persistSelectedOnSort:!1,persistSelectedOnPageChange:!1},paginationDefaultPage:1,paginationResetDefaultPage:!1,paginationTotalRows:0,paginationPerPage:10,paginationRowsPerPageOptions:[10,15,20,25,30],paginationComponent:null,paginationComponentOptions:{},paginationIconFirstPage:m.createElement(()=>m.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24","aria-hidden":"true",role:"presentation"},m.createElement("path",{d:"M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"}),m.createElement("path",{fill:"none",d:"M24 24H0V0h24v24z"})),null),paginationIconLastPage:m.createElement(()=>m.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24","aria-hidden":"true",role:"presentation"},m.createElement("path",{d:"M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"}),m.createElement("path",{fill:"none",d:"M0 0h24v24H0V0z"})),null),paginationIconNext:m.createElement(()=>m.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24","aria-hidden":"true",role:"presentation"},m.createElement("path",{d:"M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"}),m.createElement("path",{d:"M0 0h24v24H0z",fill:"none"})),null),paginationIconPrevious:m.createElement(()=>m.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24","aria-hidden":"true",role:"presentation"},m.createElement("path",{d:"M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"}),m.createElement("path",{d:"M0 0h24v24H0z",fill:"none"})),null),dense:!1,conditionalRowStyles:[],theme:"default",customStyles:{},direction:Oe.AUTO,onChangePage:k,onChangeRowsPerPage:k,onRowClicked:k,onRowDoubleClicked:k,onRowMouseEnter:k,onRowMouseLeave:k,onRowExpandToggled:k,onSelectedRowsChange:k,onSort:k,onColumnOrderChange:k},ro={rowsPerPageText:"Rows per page:",rangeSeparatorText:"of",noRowsPerPage:!1,selectAllRowsItem:!1,selectAllRowsItemText:"All"},io=p.nav`
	display: flex;
	flex: 1 1 auto;
	justify-content: flex-end;
	align-items: center;
	box-sizing: border-box;
	padding-right: 8px;
	padding-left: 8px;
	width: 100%;
	${({theme:e})=>e.pagination.style};
`,Se=p.button`
	position: relative;
	display: block;
	user-select: none;
	border: none;
	${({theme:e})=>e.pagination.pageButtonsStyle};
	${({$isRTL:e})=>e&&"transform: scale(-1, -1)"};
`,so=p.div`
	display: flex;
	align-items: center;
	border-radius: 4px;
	white-space: nowrap;
	${Rt`
    width: 100%;
    justify-content: space-around;
  `};
`,$t=p.span`
	flex-shrink: 1;
	user-select: none;
`,co=p($t)`
	margin: 0 24px;
`,go=p($t)`
	margin: 0 4px;
`;var uo=n.memo(function({rowsPerPage:e,rowCount:t,currentPage:o,direction:a=r.direction,paginationRowsPerPageOptions:l=r.paginationRowsPerPageOptions,paginationIconLastPage:i=r.paginationIconLastPage,paginationIconFirstPage:s=r.paginationIconFirstPage,paginationIconNext:g=r.paginationIconNext,paginationIconPrevious:b=r.paginationIconPrevious,paginationComponentOptions:C=r.paginationComponentOptions,onChangeRowsPerPage:u=r.onChangeRowsPerPage,onChangePage:h=r.onChangePage}){const j=(()=>{const O=typeof window=="object";function te(){return{width:O?window.innerWidth:void 0,height:O?window.innerHeight:void 0}}const[ce,ne]=n.useState(te);return n.useEffect(()=>{if(!O)return()=>null;function oe(){ne(te())}return window.addEventListener("resize",oe),()=>window.removeEventListener("resize",oe)},[]),ce})(),R=Et(a),S=j.width&&j.width>599,D=pe(t,e),w=o*e,$=w-e+1,H=o===1,v=o===D,E=Object.assign(Object.assign({},ro),C),L=o===D?`${$}-${t} ${E.rangeSeparatorText} ${t}`:`${$}-${w} ${E.rangeSeparatorText} ${t}`,M=n.useCallback(()=>h(o-1),[o,h]),x=n.useCallback(()=>h(o+1),[o,h]),y=n.useCallback(()=>h(1),[h]),V=n.useCallback(()=>h(pe(t,e)),[h,t,e]),A=n.useCallback(O=>u(Number(O.target.value),o),[o,u]),N=l.map(O=>n.createElement("option",{key:O,value:O},O));E.selectAllRowsItem&&N.push(n.createElement("option",{key:-1,value:t},E.selectAllRowsItemText));const U=n.createElement(lo,{onChange:A,defaultValue:e,"aria-label":E.rowsPerPageText},N);return n.createElement(io,{className:"rdt_Pagination"},!E.noRowsPerPage&&S&&n.createElement(n.Fragment,null,n.createElement(go,null,E.rowsPerPageText),U),S&&n.createElement(co,null,L),n.createElement(so,null,n.createElement(Se,{id:"pagination-first-page",type:"button","aria-label":"First Page","aria-disabled":H,onClick:y,disabled:H,$isRTL:R},s),n.createElement(Se,{id:"pagination-previous-page",type:"button","aria-label":"Previous Page","aria-disabled":H,onClick:M,disabled:H,$isRTL:R},b),!E.noRowsPerPage&&!S&&U,n.createElement(Se,{id:"pagination-next-page",type:"button","aria-label":"Next Page","aria-disabled":v,onClick:x,disabled:v,$isRTL:R},g),n.createElement(Se,{id:"pagination-last-page",type:"button","aria-label":"Last Page","aria-disabled":v,onClick:V,disabled:v,$isRTL:R},i)))});const ee=(e,t)=>{const o=n.useRef(!0);n.useEffect(()=>{o.current?o.current=!1:e()},t)};function po(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var bo=function(e){return function(t){return!!t&&typeof t=="object"}(e)&&!function(t){var o=Object.prototype.toString.call(t);return o==="[object RegExp]"||o==="[object Date]"||function(a){return a.$$typeof===mo}(t)}(e)},mo=typeof Symbol=="function"&&Symbol.for?Symbol.for("react.element"):60103;function me(e,t){return t.clone!==!1&&t.isMergeableObject(e)?se((o=e,Array.isArray(o)?[]:{}),e,t):e;var o}function ho(e,t,o){return e.concat(t).map(function(a){return me(a,o)})}function ft(e){return Object.keys(e).concat(function(t){return Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(t).filter(function(o){return Object.propertyIsEnumerable.call(t,o)}):[]}(e))}function wt(e,t){try{return t in e}catch{return!1}}function fo(e,t,o){var a={};return o.isMergeableObject(e)&&ft(e).forEach(function(l){a[l]=me(e[l],o)}),ft(t).forEach(function(l){(function(i,s){return wt(i,s)&&!(Object.hasOwnProperty.call(i,s)&&Object.propertyIsEnumerable.call(i,s))})(e,l)||(wt(e,l)&&o.isMergeableObject(t[l])?a[l]=function(i,s){if(!s.customMerge)return se;var g=s.customMerge(i);return typeof g=="function"?g:se}(l,o)(e[l],t[l],o):a[l]=me(t[l],o))}),a}function se(e,t,o){(o=o||{}).arrayMerge=o.arrayMerge||ho,o.isMergeableObject=o.isMergeableObject||bo,o.cloneUnlessOtherwiseSpecified=me;var a=Array.isArray(t);return a===Array.isArray(e)?a?o.arrayMerge(e,t,o):fo(e,t,o):me(t,o)}se.all=function(e,t){if(!Array.isArray(e))throw new Error("first argument should be an array");return e.reduce(function(o,a){return se(o,a,t)},{})};var wo=po(se);const xt={text:{primary:"rgba(0, 0, 0, 0.87)",secondary:"rgba(0, 0, 0, 0.54)",disabled:"rgba(0, 0, 0, 0.38)"},background:{default:"#FFFFFF"},context:{background:"#e3f2fd",text:"rgba(0, 0, 0, 0.87)"},divider:{default:"rgba(0,0,0,.12)"},button:{default:"rgba(0,0,0,.54)",focus:"rgba(0,0,0,.12)",hover:"rgba(0,0,0,.12)",disabled:"rgba(0, 0, 0, .18)"},selected:{default:"#e3f2fd",text:"rgba(0, 0, 0, 0.87)"},highlightOnHover:{default:"#EEEEEE",text:"rgba(0, 0, 0, 0.87)"},striped:{default:"#FAFAFA",text:"rgba(0, 0, 0, 0.87)"}},Ct={default:xt,light:xt,dark:{text:{primary:"#FFFFFF",secondary:"rgba(255, 255, 255, 0.7)",disabled:"rgba(0,0,0,.12)"},background:{default:"#424242"},context:{background:"#E91E63",text:"#FFFFFF"},divider:{default:"rgba(81, 81, 81, 1)"},button:{default:"#FFFFFF",focus:"rgba(255, 255, 255, .54)",hover:"rgba(255, 255, 255, .12)",disabled:"rgba(255, 255, 255, .18)"},selected:{default:"rgba(0, 0, 0, .7)",text:"#FFFFFF"},highlightOnHover:{default:"rgba(0, 0, 0, .7)",text:"#FFFFFF"},striped:{default:"rgba(0, 0, 0, .87)",text:"#FFFFFF"}}};function xo(e,t,o,a){const[l,i]=n.useState(()=>ut(e)),[s,g]=n.useState(""),b=n.useRef("");ee(()=>{i(ut(e))},[e]);const C=n.useCallback(w=>{var $,H,v;const{attributes:E}=w.target,L=($=E.getNamedItem("data-column-id"))===null||$===void 0?void 0:$.value;L&&(b.current=((v=(H=l[ve(l,L)])===null||H===void 0?void 0:H.id)===null||v===void 0?void 0:v.toString())||"",g(b.current))},[l]),u=n.useCallback(w=>{var $;const{attributes:H}=w.target,v=($=H.getNamedItem("data-column-id"))===null||$===void 0?void 0:$.value;if(v&&b.current&&v!==b.current){const E=ve(l,b.current),L=ve(l,v),M=[...l];M[E]=l[L],M[L]=l[E],i(M),t(M)}},[t,l]),h=n.useCallback(w=>{w.preventDefault()},[]),j=n.useCallback(w=>{w.preventDefault()},[]),R=n.useCallback(w=>{w.preventDefault(),b.current="",g("")},[]),S=function(w=!1){return w?Q.ASC:Q.DESC}(a),D=n.useMemo(()=>l[ve(l,o==null?void 0:o.toString())]||{},[o,l]);return{tableColumns:l,draggingColumnId:s,handleDragStart:C,handleDragEnter:u,handleDragOver:h,handleDragLeave:j,handleDragEnd:R,defaultSortDirection:S,defaultSortColumn:D}}var Ro=n.memo(function(e){const{data:t=r.data,columns:o=r.columns,title:a=r.title,actions:l=r.actions,keyField:i=r.keyField,striped:s=r.striped,highlightOnHover:g=r.highlightOnHover,pointerOnHover:b=r.pointerOnHover,dense:C=r.dense,selectableRows:u=r.selectableRows,selectableRowsSingle:h=r.selectableRowsSingle,selectableRowsHighlight:j=r.selectableRowsHighlight,selectableRowsNoSelectAll:R=r.selectableRowsNoSelectAll,selectableRowsVisibleOnly:S=r.selectableRowsVisibleOnly,selectableRowSelected:D=r.selectableRowSelected,selectableRowDisabled:w=r.selectableRowDisabled,selectableRowsComponent:$=r.selectableRowsComponent,selectableRowsComponentProps:H=r.selectableRowsComponentProps,onRowExpandToggled:v=r.onRowExpandToggled,onSelectedRowsChange:E=r.onSelectedRowsChange,expandableIcon:L=r.expandableIcon,onChangeRowsPerPage:M=r.onChangeRowsPerPage,onChangePage:x=r.onChangePage,paginationServer:y=r.paginationServer,paginationServerOptions:V=r.paginationServerOptions,paginationTotalRows:A=r.paginationTotalRows,paginationDefaultPage:N=r.paginationDefaultPage,paginationResetDefaultPage:U=r.paginationResetDefaultPage,paginationPerPage:O=r.paginationPerPage,paginationRowsPerPageOptions:te=r.paginationRowsPerPageOptions,paginationIconLastPage:ce=r.paginationIconLastPage,paginationIconFirstPage:ne=r.paginationIconFirstPage,paginationIconNext:oe=r.paginationIconNext,paginationIconPrevious:$e=r.paginationIconPrevious,paginationComponent:Pe=r.paginationComponent,paginationComponentOptions:ke=r.paginationComponentOptions,responsive:De=r.responsive,progressPending:B=r.progressPending,progressComponent:he=r.progressComponent,persistTableHead:G=r.persistTableHead,noDataComponent:fe=r.noDataComponent,disabled:Z=r.disabled,noTableHead:He=r.noTableHead,noHeader:Fe=r.noHeader,fixedHeader:we=r.fixedHeader,fixedHeaderScrollHeight:je=r.fixedHeaderScrollHeight,pagination:X=r.pagination,subHeader:J=r.subHeader,subHeaderAlign:xe=r.subHeaderAlign,subHeaderWrap:Ce=r.subHeaderWrap,subHeaderComponent:Ie=r.subHeaderComponent,noContextMenu:Te=r.noContextMenu,contextMessage:Le=r.contextMessage,contextActions:P=r.contextActions,contextComponent:Pt=r.contextComponent,expandableRows:ye=r.expandableRows,onRowClicked:Be=r.onRowClicked,onRowDoubleClicked:Ge=r.onRowDoubleClicked,onRowMouseEnter:Ve=r.onRowMouseEnter,onRowMouseLeave:Ue=r.onRowMouseLeave,sortIcon:kt=r.sortIcon,onSort:Dt=r.onSort,sortFunction:Xe=r.sortFunction,sortServer:Me=r.sortServer,expandableRowsComponent:Ht=r.expandableRowsComponent,expandableRowsComponentProps:Ft=r.expandableRowsComponentProps,expandableRowDisabled:Ke=r.expandableRowDisabled,expandableRowsHideExpander:Ye=r.expandableRowsHideExpander,expandOnRowClicked:jt=r.expandOnRowClicked,expandOnRowDoubleClicked:It=r.expandOnRowDoubleClicked,expandableRowExpanded:Qe=r.expandableRowExpanded,expandableInheritConditionalStyles:Tt=r.expandableInheritConditionalStyles,defaultSortFieldId:Lt=r.defaultSortFieldId,defaultSortAsc:Mt=r.defaultSortAsc,clearSelectedRows:Ze=r.clearSelectedRows,conditionalRowStyles:At=r.conditionalRowStyles,theme:Je=r.theme,customStyles:qe=r.customStyles,direction:ge=r.direction,onColumnOrderChange:_t=r.onColumnOrderChange,className:zt,ariaLabel:et}=e,{tableColumns:tt,draggingColumnId:nt,handleDragStart:ot,handleDragEnter:at,handleDragOver:lt,handleDragLeave:rt,handleDragEnd:it,defaultSortDirection:Nt,defaultSortColumn:Wt}=xo(o,_t,Lt,Mt),[{rowsPerPage:K,currentPage:_,selectedRows:Ae,allSelected:st,selectedCount:dt,selectedColumn:W,sortDirection:ae,toggleOnSelectedRowsChange:Bt},q]=n.useReducer(sn,{allSelected:!1,selectedCount:0,selectedRows:[],selectedColumn:Wt,toggleOnSelectedRowsChange:!1,sortDirection:Nt,currentPage:N,rowsPerPage:O,selectedRowsFlag:!1,contextMessage:r.contextMessage}),{persistSelectedOnSort:ct=!1,persistSelectedOnPageChange:Re=!1}=V,gt=!(!y||!Re&&!ct),Gt=X&&!B&&t.length>0,Vt=Pe||uo,Ut=n.useMemo(()=>((d={},f="default",T="default")=>{const z=Ct[f]?f:T;return wo({table:{style:{color:(c=Ct[z]).text.primary,backgroundColor:c.background.default}},tableWrapper:{style:{display:"table"}},responsiveWrapper:{style:{}},header:{style:{fontSize:"22px",color:c.text.primary,backgroundColor:c.background.default,minHeight:"56px",paddingLeft:"16px",paddingRight:"8px"}},subHeader:{style:{backgroundColor:c.background.default,minHeight:"52px"}},head:{style:{color:c.text.primary,fontSize:"12px",fontWeight:500}},headRow:{style:{backgroundColor:c.background.default,minHeight:"52px",borderBottomWidth:"1px",borderBottomColor:c.divider.default,borderBottomStyle:"solid"},denseStyle:{minHeight:"32px"}},headCells:{style:{paddingLeft:"16px",paddingRight:"16px"},draggingStyle:{cursor:"move"}},contextMenu:{style:{backgroundColor:c.context.background,fontSize:"18px",fontWeight:400,color:c.context.text,paddingLeft:"16px",paddingRight:"8px",transform:"translate3d(0, -100%, 0)",transitionDuration:"125ms",transitionTimingFunction:"cubic-bezier(0, 0, 0.2, 1)",willChange:"transform"},activeStyle:{transform:"translate3d(0, 0, 0)"}},cells:{style:{paddingLeft:"16px",paddingRight:"16px",wordBreak:"break-word"},draggingStyle:{}},rows:{style:{fontSize:"13px",fontWeight:400,color:c.text.primary,backgroundColor:c.background.default,minHeight:"48px","&:not(:last-of-type)":{borderBottomStyle:"solid",borderBottomWidth:"1px",borderBottomColor:c.divider.default}},denseStyle:{minHeight:"32px"},selectedHighlightStyle:{"&:nth-of-type(n)":{color:c.selected.text,backgroundColor:c.selected.default,borderBottomColor:c.background.default}},highlightOnHoverStyle:{color:c.highlightOnHover.text,backgroundColor:c.highlightOnHover.default,transitionDuration:"0.15s",transitionProperty:"background-color",borderBottomColor:c.background.default,outlineStyle:"solid",outlineWidth:"1px",outlineColor:c.background.default},stripedStyle:{color:c.striped.text,backgroundColor:c.striped.default}},expanderRow:{style:{color:c.text.primary,backgroundColor:c.background.default}},expanderCell:{style:{flex:"0 0 48px"}},expanderButton:{style:{color:c.button.default,fill:c.button.default,backgroundColor:"transparent",borderRadius:"2px",transition:"0.25s",height:"100%",width:"100%","&:hover:enabled":{cursor:"pointer"},"&:disabled":{color:c.button.disabled},"&:hover:not(:disabled)":{cursor:"pointer",backgroundColor:c.button.hover},"&:focus":{outline:"none",backgroundColor:c.button.focus},svg:{margin:"auto"}}},pagination:{style:{color:c.text.secondary,fontSize:"13px",minHeight:"56px",backgroundColor:c.background.default,borderTopStyle:"solid",borderTopWidth:"1px",borderTopColor:c.divider.default},pageButtonsStyle:{borderRadius:"50%",height:"40px",width:"40px",padding:"8px",margin:"px",cursor:"pointer",transition:"0.4s",color:c.button.default,fill:c.button.default,backgroundColor:"transparent","&:disabled":{cursor:"unset",color:c.button.disabled,fill:c.button.disabled},"&:hover:not(:disabled)":{backgroundColor:c.button.hover},"&:focus":{outline:"none",backgroundColor:c.button.focus}}},noData:{style:{display:"flex",alignItems:"center",justifyContent:"center",color:c.text.primary,backgroundColor:c.background.default}},progress:{style:{display:"flex",alignItems:"center",justifyContent:"center",color:c.text.primary,backgroundColor:c.background.default}}},d);var c})(qe,Je),[qe,Je]),Xt=n.useMemo(()=>Object.assign({},ge!=="auto"&&{dir:ge}),[ge]),I=n.useMemo(()=>{if(Me)return t;if(W!=null&&W.sortFunction&&typeof W.sortFunction=="function"){const d=W.sortFunction,f=ae===Q.ASC?d:(T,z)=>-1*d(T,z);return[...t].sort(f)}return function(d,f,T,z){return f?z&&typeof z=="function"?z(d.slice(0),f,T):d.slice(0).sort((c,_e)=>{const re=f(c),Y=f(_e);if(T==="asc"){if(re<Y)return-1;if(re>Y)return 1}if(T==="desc"){if(re>Y)return-1;if(re<Y)return 1}return 0}):d}(t,W==null?void 0:W.selector,ae,Xe)},[Me,W,ae,t,Xe]),ue=n.useMemo(()=>{if(X&&!y){const d=_*K,f=d-K;return I.slice(f,d)}return I},[_,X,y,K,I]),Kt=n.useCallback(d=>{q(d)},[]),Yt=n.useCallback(d=>{q(d)},[]),Qt=n.useCallback(d=>{q(d)},[]),Zt=n.useCallback((d,f)=>Be(d,f),[Be]),Jt=n.useCallback((d,f)=>Ge(d,f),[Ge]),qt=n.useCallback((d,f)=>Ve(d,f),[Ve]),en=n.useCallback((d,f)=>Ue(d,f),[Ue]),le=n.useCallback(d=>q({type:"CHANGE_PAGE",page:d,paginationServer:y,visibleOnly:S,persistSelectedOnPageChange:Re}),[y,Re,S]),tn=n.useCallback(d=>{const f=pe(A||ue.length,d),T=ze(_,f);y||le(T),q({type:"CHANGE_ROWS_PER_PAGE",page:T,rowsPerPage:d})},[_,le,y,A,ue.length]);if(X&&!y&&I.length>0&&ue.length===0){const d=pe(I.length,K),f=ze(_,d);le(f)}ee(()=>{E({allSelected:st,selectedCount:dt,selectedRows:Ae.slice(0)})},[Bt]),ee(()=>{Dt(W,ae,I.slice(0))},[W,ae]),ee(()=>{x(_,A||I.length)},[_]),ee(()=>{M(K,_)},[K]),ee(()=>{le(N)},[N,U]),ee(()=>{if(X&&y&&A>0){const d=pe(A,K),f=ze(_,d);_!==f&&le(f)}},[A]),n.useEffect(()=>{q({type:"CLEAR_SELECTED_ROWS",selectedRowsFlag:Ze})},[h,Ze]),n.useEffect(()=>{if(!D)return;const d=I.filter(T=>D(T)),f=h?d.slice(0,1):d;q({type:"SELECT_MULTIPLE_ROWS",keyField:i,selectedRows:f,totalRows:I.length,mergeSelections:gt})},[t,D]);const nn=S?ue:I,on=Re||h||R;return n.createElement(an,{theme:Ut},!Fe&&(!!a||!!l)&&n.createElement(Xn,{title:a,actions:l,showMenu:!Te,selectedCount:dt,direction:ge,contextActions:P,contextComponent:Pt,contextMessage:Le}),J&&n.createElement(Qn,{align:xe,wrapContent:Ce},Ie),n.createElement(Jn,Object.assign({$responsive:De,$fixedHeader:we,$fixedHeaderScrollHeight:je,className:zt},Xt),n.createElement(qn,null,B&&!G&&n.createElement(ht,null,he),n.createElement(cn,Object.assign({disabled:Z,className:"rdt_Table",role:"table"},et&&{"aria-label":et}),!He&&(!!G||I.length>0&&!B)&&n.createElement(un,{className:"rdt_TableHead",role:"rowgroup",$fixedHeader:we},n.createElement(pn,{className:"rdt_TableHeadRow",role:"row",$dense:C},u&&(on?n.createElement(de,{style:{flex:"0 0 48px"}}):n.createElement(zn,{allSelected:st,selectedRows:Ae,selectableRowsComponent:$,selectableRowsComponentProps:H,selectableRowDisabled:w,rowData:nn,keyField:i,mergeSelections:gt,onSelectAllRows:Yt})),ye&&!Ye&&n.createElement(eo,null),tt.map(d=>n.createElement(An,{key:d.id,column:d,selectedColumn:W,disabled:B||I.length===0,pagination:X,paginationServer:y,persistSelectedOnSort:ct,selectableRowsVisibleOnly:S,sortDirection:ae,sortIcon:kt,sortServer:Me,onSort:Kt,onDragStart:ot,onDragOver:lt,onDragEnd:it,onDragEnter:at,onDragLeave:rt,draggingColumnId:nt})))),!I.length&&!B&&n.createElement(to,null,fe),B&&G&&n.createElement(ht,null,he),!B&&I.length>0&&n.createElement(Zn,{className:"rdt_TableBody",role:"rowgroup"},ue.map((d,f)=>{const T=ie(d,i),z=function(Y=""){return typeof Y!="number"&&(!Y||Y.length===0)}(T)?f:T,c=Ee(d,Ae,i),_e=!!(ye&&Qe&&Qe(d)),re=!!(ye&&Ke&&Ke(d));return n.createElement(Hn,{id:z,key:z,keyField:i,"data-row-id":z,columns:tt,row:d,rowCount:I.length,rowIndex:f,selectableRows:u,expandableRows:ye,expandableIcon:L,highlightOnHover:g,pointerOnHover:b,dense:C,expandOnRowClicked:jt,expandOnRowDoubleClicked:It,expandableRowsComponent:Ht,expandableRowsComponentProps:Ft,expandableRowsHideExpander:Ye,defaultExpanderDisabled:re,defaultExpanded:_e,expandableInheritConditionalStyles:Tt,conditionalRowStyles:At,selected:c,selectableRowsHighlight:j,selectableRowsComponent:$,selectableRowsComponentProps:H,selectableRowDisabled:w,selectableRowsSingle:h,striped:s,onRowExpandToggled:v,onRowClicked:Zt,onRowDoubleClicked:Jt,onRowMouseEnter:qt,onRowMouseLeave:en,onSelectedRow:Qt,draggingColumnId:nt,onDragStart:ot,onDragOver:lt,onDragEnd:it,onDragEnter:at,onDragLeave:rt})}))))),Gt&&n.createElement("div",null,n.createElement(Vt,{onChangePage:le,onChangeRowsPerPage:tn,rowCount:A||I.length,currentPage:_,rowsPerPage:K,direction:ge,paginationRowsPerPageOptions:te,paginationIconLastPage:ce,paginationIconFirstPage:ne,paginationIconNext:oe,paginationIconPrevious:$e,paginationComponentOptions:ke})))});export{Ro as X};
