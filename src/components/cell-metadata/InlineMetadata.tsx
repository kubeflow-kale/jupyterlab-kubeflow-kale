/*
 * Copyright 2019-2020 The Kale Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import { Chip, Tooltip } from '@material-ui/core';
import ColorUtils from './ColorUtils';
import {
  RESERVED_CELL_NAMES,
  RESERVED_CELL_NAMES_HELP_TEXT,
} from './CellMetadataEditor';

interface IProps {
  blockName: string;
  parentBlockName: string;
  prevBlockNames: string[];
  cellElement: any;
}

interface IState {
  defaultCSSClasses: string;
  className: string;
  cellTypeClass: string;
  color: string;
  dependencies: any[];
}

const DefaultState: IState = {
  defaultCSSClasses: `kale-inline-cell-metadata`,
  className: `kale-inline-cell-metadata`,
  cellTypeClass: '',
  color: '',
  dependencies: [],
};

export class InlineMetadata extends React.Component<IProps, IState> {
  wrapperRef: React.RefObject<HTMLDivElement> = null;
  state = DefaultState;

  constructor(props: IProps) {
    super(props);
    this.wrapperRef = React.createRef();
  }

  componentDidMount() {
    this.updateClassName();
    this.checkIfReservedName();
    this.updateStyles();
    this.updateDependencies();
    this.moveElement();
  }

  componentWillUnmount() {
    const cellElement = this.props.cellElement;
    cellElement.classList.remove('kale-merged-cell');

    const codeMirrorElem = cellElement.querySelector('.CodeMirror');
    if (codeMirrorElem) {
      codeMirrorElem.style.border = '';
    }

    if (this.wrapperRef) {
      this.wrapperRef.current.remove();
    }
  }

  componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
    if (
      prevProps.blockName !== this.props.blockName ||
      prevProps.parentBlockName !== this.props.parentBlockName ||
      prevProps.prevBlockNames !== this.props.prevBlockNames ||
      prevProps.cellElement !== this.props.cellElement
    ) {
      this.updateClassName();
      this.checkIfReservedName();
      this.updateStyles();
      this.updateDependencies();
    }
  }

  updateClassName() {
    let c = this.state.defaultCSSClasses;
    if (this.props.parentBlockName) {
      c = c + ' hidden';
    }
    this.setState({ className: c });
  }

  checkIfReservedName() {
    let cellTypeClass = '';
    if (RESERVED_CELL_NAMES.includes(this.props.blockName)) {
      cellTypeClass = 'kale-reserved-cell';
    }
    this.setState({ cellTypeClass });
  }

  updateStyles() {
    const name = this.props.blockName || this.props.parentBlockName;
    if (!name) {
      return;
    }
    const rgb = this.getColorFromName(name);
    this.setState({ color: rgb });

    const cellElement = this.props.cellElement;

    const codeMirrorElem = cellElement.querySelector(
      '.CodeMirror',
    ) as HTMLElement;
    if (codeMirrorElem) {
      codeMirrorElem.style.border = `1px solid #${rgb}`;
    }
    if (this.props.parentBlockName) {
      cellElement.classList.add('kale-merged-cell');
    }
  }

  getColorFromName(name: string) {
    return ColorUtils.getColor(name);
  }

  updateDependencies() {
    const dependencies = this.props.prevBlockNames.map((name, i) => {
      const rgb = this.getColorFromName(name);
      return (
        <Tooltip placement="top" key={i} title={name}>
          <div
            className="kale-inline-cell-dependency"
            style={{
              backgroundColor: `#${rgb}`,
            }}
          ></div>
        </Tooltip>
      );
    });
    this.setState({ dependencies });
  }

  moveElement() {
    // FIXME:  need moved class??
    if (
      (this.props.blockName || this.props.parentBlockName) &&
      this.wrapperRef &&
      !this.wrapperRef.current.classList.contains('moved')
    ) {
      this.wrapperRef.current.classList.add('moved');
      this.props.cellElement.insertAdjacentElement(
        'afterbegin',
        this.wrapperRef.current,
      );
    }
  }

  render() {
    return (
      <div>
        <div className={this.state.className} ref={this.wrapperRef}>
          {/* Add a `step: ` string before the Chip in case the chip belongs to a pipeline step*/}
          {RESERVED_CELL_NAMES.includes(this.props.blockName) ? (
            ''
          ) : (
            <p style={{ fontStyle: 'italic', marginRight: '5px' }}>step: </p>
          )}

          <Tooltip
            placement="top"
            key={this.props.blockName + 'tooltip'}
            title={
              RESERVED_CELL_NAMES.includes(this.props.blockName)
                ? RESERVED_CELL_NAMES_HELP_TEXT[this.props.blockName]
                : 'This cell starts the pipeline step: ' + this.props.blockName
            }
          >
            <Chip
              className={`kale-chip ${this.state.cellTypeClass}`}
              style={{ backgroundColor: `#${this.state.color}` }}
              key={this.props.blockName}
              label={this.props.blockName}
            />
          </Tooltip>

          {/* Add a `depends on: ` string before the deps dots in case there are some*/}
          {this.state.dependencies.length > 0 ? (
            <p style={{ fontStyle: 'italic', margin: '0 5px' }}>depends on: </p>
          ) : (
            ''
          )}
          {this.state.dependencies}
        </div>
      </div>
    );
  }
}
