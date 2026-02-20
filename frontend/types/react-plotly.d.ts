declare module 'react-plotly.js' {
    import { Component } from 'react';
    import * as Plotly from 'plotly.js';

    export interface PlotParams {
        data: Plotly.Data[];
        layout?: Partial<Plotly.Layout>;
        config?: Partial<Plotly.Config>;
        frames?: Plotly.Frame[];
        useResizeHandler?: boolean;
        style?: React.CSSProperties;
        className?: string;
        onInitialized?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void;
        onUpdate?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void;
        onPurge?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void;
        onError?: (err: Readonly<Error>) => void;
        onRelayout?: (event: Readonly<Plotly.PlotRelayoutEvent>) => void;
        onRedraw?: () => void;
        onBeforeHover?: (event: Readonly<Plotly.PlotHoverEvent>) => boolean | void;
        onHover?: (event: Readonly<Plotly.PlotHoverEvent>) => void;
        onUnhover?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
        onSelected?: (event: Readonly<Plotly.PlotSelectionEvent>) => void;
        onDeselect?: () => void;
        onClick?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
    }

    export default class extends Component<PlotParams> { }
}
