import * as React from "react";

import ColorUtils from './ColorUtils';

interface InlineMetadata {
    blockName: string;
    parentBlockName: string;
    prevBlockNames?: string[]
    cellIndex: number;
    cellElement: any;
}

const RESERVED_CELL_NAMES = ['imports', 'functions', 'pipeline-parameters', 'skip'];

export const InlineMetadata: React.FunctionComponent<InlineMetadata> = (props) => {
    let wrapperRef: HTMLElement = null;

    const [className, setClassName] = React.useState('');
    const [dependencies, setDependencies] = React.useState([]);
    const [color, setColor] = React.useState('');
    const [cellTypeClass, setCellTypeClass] = React.useState('');

    React.useEffect(() => {
        updateClassName()
        updateStyles()
        setDependencies(props.prevBlockNames.map((name, i) => {
            const rgb = getColor(name)
            // https://material-ui.com/components/tooltips/
            return <div
                key={i}
                className="inline-cell-dep"
                style={{
                    backgroundColor: `#${rgb}`
                }}></div>
        }))
        const elem = wrapperRef

        if (RESERVED_CELL_NAMES.includes('props.blockName')) {
            setCellTypeClass('kale-reserved-cell')
        }
        if ((props.blockName || props.parentBlockName) && elem && !elem.classList.contains('moved')) {
            elem.classList.add('moved');
            props.cellElement.insertAdjacentElement('afterbegin', elem);
        }
    }, [props.blockName, props.parentBlockName, props.prevBlockNames, props.cellIndex, props.cellElement]);

    React.useEffect(() => {
        // https://reactjs.org/docs/hooks-effect.html
        // imitate componentWillUnmount
        return () => {
            // Cleanup

            const parent = props.cellElement;
            parent.classList.remove('kale-merged-cell');

            const divWrapper = parent.querySelector('.CodeMirror')
            divWrapper.style.border = ''

            const elem = document.querySelector(`.inline-cell-metadata-${props.cellIndex}`);
            if (elem) {
                elem.remove()
            }
        }
    }, []);

    const updateClassName = () => {
        let c = `inline-cell-metadata inline-cell-metadata-${props.cellIndex}`;
        if (props.parentBlockName) {
            c = c + ' hidden'
        }
        setClassName(c)
    }

    const updateStyles = () => {
        const name = props.blockName || props.parentBlockName;
        if (!name) {
            return;
        }
        const rgb = getColor(name)
        setColor(`${rgb}`);

        const cellElement = props.cellElement;

        const divWrapper = cellElement.querySelector('.CodeMirror') as HTMLElement;
        divWrapper.style.border = `2px solid #${rgb}`

        if (props.parentBlockName) {
            cellElement.classList.add('kale-merged-cell');
        }

    }

    const getColor = (name: string) => {
        return ColorUtils.getColor(name);
    }

    return (
        <div>
            <div className={className} ref={(div) => { wrapperRef = div; }} >
                <div>
                    <span
                        className={`inline-cell-metadata-name ${cellTypeClass}`}
                        style={{
                            backgroundColor: `#${color}`
                        }}>
                        {props.blockName}
                    </span>
                    {dependencies}
                </div>
            </div>
        </div>
    );
};