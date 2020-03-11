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
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import Switch from 'react-switch';
import CellUtils from '../../utils/CellUtils';
import { InlineMetadata } from './InlineMetadata';
import {
  CellMetadataEditor,
  RESERVED_CELL_NAMES,
  IProps as EditorProps,
} from './CellMetadataEditor';
import { CellMetadataContext } from './CellMetadataContext';
import { isCodeCellModel, CodeCellModel } from '@jupyterlab/cells';

interface IProps {
  notebook: NotebookPanel;
  activeCellIndex: number;
  onMetadataEnable: (isEnabled: boolean) => void;
}

interface IState {
  prevBlockName?: string;
  metadataCmp?: JSX.Element[];
  checked?: boolean;
  editors?: any[];
  isEditorVisible: boolean;
}

const DefaultState: IState = {
  prevBlockName: null,
  metadataCmp: [],
  checked: false,
  editors: [],
  isEditorVisible: false,
};

type SaveState = 'started' | 'completed' | 'failed';

export class InlineCellsMetadata extends React.Component<IProps, IState> {
  state = DefaultState;

  constructor(props: IProps) {
    super(props);
    this.onEditorVisibilityChange = this.onEditorVisibilityChange.bind(this);
  }

  componentDidUpdate = async (
    prevProps: Readonly<IProps>,
    prevState: Readonly<IState>,
  ) => {
    if (!this.props.notebook && prevProps.notebook) {
      // no notebook
      this.removeCells();
    }

    const preNotebookId = prevProps.notebook ? prevProps.notebook.id : '';
    const notebookId = this.props.notebook ? this.props.notebook.id : '';
    if (preNotebookId !== notebookId) {
      // notebook changed
      if (prevProps.notebook) {
        prevProps.notebook.context.saveState.disconnect(this.handleSaveState);
        // prevProps.notebook.model is null
        // potential memory leak ??
        // prevProps.notebook.model.cells.changed.disconnect(this.handleCellChange);
      }
      if (this.props.notebook) {
        this.props.notebook.context.ready.then(() => {
          this.props.notebook.context.saveState.connect(this.handleSaveState);
          this.props.notebook.model.cells.changed.connect(
            this.handleCellChange,
          );
          this.resetMetadataComponents();
        });
      }

      // hide editor on notebook change
      this.setState({ isEditorVisible: false });
    }
  };

  handleSaveState = (context: DocumentRegistry.Context, state: SaveState) => {
    if (state === 'completed') {
      if (this.state.checked) {
        this.addMetadataInfo();
      }
    }
  };

  handleCellChange = (cells: any, args: any) => {
    const types = ['add', 'remove', 'move', 'set'];
    if (types.includes(args.type)) {
      this.resetMetadataComponents();
    }
    if (args.type === 'set' && args.oldValues[0] instanceof CodeCellModel) {
      CellUtils.setCellMetaData(
        this.props.notebook,
        args.newIndex,
        'tags',
        [],
        true,
      );
    }
  };

  resetMetadataComponents() {
    if (this.state.checked) {
      this.removeCells(() => {
        this.addMetadataInfo();
      });
      this.setState({ isEditorVisible: false });
    }
  }

  addMetadataInfo = () => {
    if (!this.props.notebook) {
      return;
    }

    const cells = this.props.notebook.model.cells;
    const allTags: any[] = [];
    const metadata: any[] = [];
    const editors: any[] = [];
    for (let index = 0; index < cells.length; index++) {
      let tags = this.getKaleCellTags(this.props.notebook.content, index);
      if (!tags) {
        tags = {
          blockName: '',
          prevBlockNames: [],
        };
      }
      allTags.push(tags);
      let previousBlockName = '';

      if (!tags.blockName) {
        previousBlockName = this.getPreviousBlock(
          this.props.notebook.content,
          index,
        );
      }
      const cellModel = this.props.notebook.model.cells.get(
        this.props.activeCellIndex,
      );
      const editorProps: EditorProps = {
        notebook: this.props.notebook,
        cellModel: cellModel,
        stepName: tags.blockName || '',
        stepDependencies: tags.prevBlockNames || [],
      };
      editors.push(editorProps);

      const isCodeCell = isCodeCellModel(
        this.props.notebook.model.cells.get(index),
      );
      if (isCodeCell) {
        metadata.push(
          <InlineMetadata
            key={index}
            cellElement={this.props.notebook.content.node.childNodes[index]}
            blockName={tags.blockName}
            stepDependencies={tags.prevBlockNames}
            previousBlockName={previousBlockName}
            cellIndex={index}
          />,
        );
      }
    }

    this.setState({
      metadataCmp: metadata,
      editors: editors,
    });
  };

  removeCells = (callback?: () => void) => {
    // triggers cleanup in InlineMetadata
    this.setState({ metadataCmp: [], editors: [] }, () => {
      if (callback) {
        callback();
      }
    });
  };

  getAllBlocks = (notebook: Notebook): string[] => {
    let blocks = new Set<string>();
    for (const idx of Array(notebook.model.cells.length).keys()) {
      let mt = this.getKaleCellTags(notebook, idx);
      if (mt && mt.blockName && mt.blockName !== '') {
        blocks.add(mt.blockName);
      }
    }
    return Array.from(blocks);
  };

  getPreviousBlock = (notebook: Notebook, current: number): string => {
    for (let i = current - 1; i >= 0; i--) {
      let mt = this.getKaleCellTags(notebook, i);
      if (
        mt &&
        mt.blockName &&
        mt.blockName !== 'skip' &&
        mt.blockName !== ''
      ) {
        return mt.blockName;
      }
    }
    return null;
  };

  getKaleCellTags = (notebook: Notebook, index: number) => {
    const tags: string[] = CellUtils.getCellMetaData(notebook, index, 'tags');
    if (tags) {
      let b_name = tags.map(v => {
        if (RESERVED_CELL_NAMES.includes(v)) {
          return v;
        }
        if (v.startsWith('block:')) {
          return v.replace('block:', '');
        }
      });

      let prevs = tags
        .filter(v => {
          return v.startsWith('prev:');
        })
        .map(v => {
          return v.replace('prev:', '');
        });
      return {
        blockName: b_name[0],
        prevBlockNames: prevs,
      };
    }
    return null;
  };

  handleChange(checked: boolean) {
    this.setState({ checked });
    this.props.onMetadataEnable(checked);

    if (checked) {
      this.addMetadataInfo();
    } else {
      this.setState({ isEditorVisible: false });
      this.removeCells();
    }
  }

  onEditorVisibilityChange(isEditorVisible: boolean) {
    this.setState({ isEditorVisible });
  }

  render() {
    const editorProps = {
      ...this.state.editors[this.props.activeCellIndex],
    };
    return (
      <React.Fragment>
        <div className="toolbar input-container">
          <div className={'switch-label'}>Enable</div>
          <Switch
            checked={this.state.checked}
            onChange={c => this.handleChange(c)}
            onColor="#599EF0"
            onHandleColor="#477EF0"
            handleDiameter={18}
            uncheckedIcon={false}
            checkedIcon={false}
            boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
            activeBoxShadow="0px 0px 1px 7px rgba(0, 0, 0, 0.2)"
            height={10}
            width={20}
          />
        </div>
        <div className="hidden">
          <CellMetadataContext.Provider
            value={{
              activeCellIndex: this.props.activeCellIndex,
              isEditorVisible: this.state.isEditorVisible,
              onEditorVisibilityChange: this.onEditorVisibilityChange,
            }}
          >
            <CellMetadataEditor
              notebook={editorProps.notebook}
              cellModel={editorProps.cellModel}
              stepName={editorProps.stepName}
              stepDependencies={editorProps.stepDependencies}
            />
            {this.state.metadataCmp}
          </CellMetadataContext.Provider>
        </div>
      </React.Fragment>
    );
  }
}
