import * as React from "react";
import {
    INotebookTracker, Notebook,
    NotebookPanel
} from "@jupyterlab/notebook";
import NotebookUtils from "../utils/NotebookUtils";
import Switch from "react-switch";

import {
    CollapsablePanel,
    MaterialInput
} from "./Components";
import {CellTags} from "./CellTags";
import {Cell} from "@jupyterlab/cells";
import {VolumesPanel} from "./VolumesPanel";
import {SplitDeployButton} from "./DeployButton";
import {ExperimentInput} from "./ExperimentInput";

const KALE_NOTEBOOK_METADATA_KEY = 'kubeflow_noteobok';

enum RPC_CALL_STATUS {
    OK = 0,
    ImportError = 1,
    ExecutionError = 2,
}

const getRpcStatusName = (code: number) => {
    switch(code) {
        case RPC_CALL_STATUS.OK:
            return 'OK';
        case RPC_CALL_STATUS.ImportError:
            return 'ImportError';
        case RPC_CALL_STATUS.ExecutionError:
                return 'ExecutionError';
        default:
            return 'UnknownError';
    }
};

export interface ISelectOption {
    label: string;
    value: string;
}

export interface IExperiment {
    id: string;
    name: string;
}

export const NEW_EXPERIMENT: IExperiment = {
    name: "+ New Experiment",
    id: "new"
};
const selectVolumeSizeTypes = [
    {label: "Gi", value: "Gi", base: 1024 ** 3},
    {label: "Mi", value: "Mi", base: 1024 ** 2},
    {label: "Ki", value: "Ki", base: 1024 ** 1},
    {label: "", value: "", base: 1024 ** 0},
];

const selectVolumeTypes = [
    {label: "Create Empty Volume", value: 'new_pvc'},
    {label: "Clone Notebook Volume", value: 'clone'},
    {label: "Clone Existing Snapshot", value: 'snap'},
    {label: "Use Existing Volume", value: 'pvc'},
];

interface IProps {
    tracker: INotebookTracker;
    notebook: NotebookPanel
}

interface IState {
    metadata: IKaleNotebookMetadata;
    runDeployment: boolean;
    deploymentType: string;
    deployDebugMessage: boolean;
    selectVal: string;
    activeNotebook?: NotebookPanel;
    activeCell?: Cell;
    activeCellIndex?: number;
    experiments: IExperiment[];
    gettingExperiments: boolean;
    notebookVolumes?: IVolumeMetadata[];
    volumes?: IVolumeMetadata[];
    selectVolumeTypes: {label: string, value: string}[];
    useNotebookVolumes: boolean;
    mounted: boolean;
}

export interface IAnnotation {
    key: string,
    value: string
}

export interface IVolumeMetadata {
    type: string,
    // name field will have different meaning based on the type:
    //  - pv: name of the PV
    //  - pvc: name of the pvc
    //  - new_pvc: new pvc with dynamic provisioning
    //  - clone: clone a volume which is currently mounted to the Notebook Server
    //  - snap: new_pvc from Rok Snapshot
    name: string,
    mount_point: string,
    size?: number,
    size_type?: string,
    annotations: IAnnotation[],
    snapshot: boolean,
    snapshot_name?: string
}

// keep names with Python notation because they will be read
// in python by Kale.
interface IKaleNotebookMetadata {
    experiment: IExperiment;
    experiment_name: string;    // Keep this for backwards compatibility
    pipeline_name: string;
    pipeline_description: string;
    docker_image: string;
    volumes: IVolumeMetadata[];
}

const DefaultState: IState = {
    metadata: {
        experiment: {id: '', name: ''},
        experiment_name: '',
        pipeline_name: '',
        pipeline_description: '',
        docker_image: '',
        volumes: []
    },
    runDeployment: false,
    deploymentType: 'compile',
    deployDebugMessage: false,
    selectVal: '',
    activeNotebook: null,
    activeCell: null,
    activeCellIndex: 0,
    experiments: [],
    gettingExperiments: false,
    notebookVolumes: [],
    volumes: [],
    selectVolumeTypes: selectVolumeTypes,
    useNotebookVolumes: true,
    mounted: false,
};

const DefaultEmptyVolume: IVolumeMetadata = {
    type: 'new_pvc',
    name: '',
    mount_point: '',
    annotations: [],
    size: 1,
    size_type: 'Gi',
    snapshot: false,
    snapshot_name: '',
};

const DefaultEmptyAnnotation: IAnnotation = {
    key: '',
    value: ''
};

export class KubeflowKaleLeftPanel extends React.Component<IProps, IState> {
    // init state default values
    state = DefaultState;

    removeIdxFromArray = (index: number, arr: Array<any>): Array<any> => {return arr.slice(0, index).concat(arr.slice(index + 1, arr.length))};
    updateIdxInArray = (element: any, index: number, arr: Array<any>): Array<any> => {return arr.slice(0, index).concat([element]).concat(arr.slice(index + 1, arr.length))};

    updateSelectValue = (val: string) => this.setState({selectVal: val});
    // update metadata state values: use destructure operator to update nested dict
    updateExperiment = (experiment: IExperiment) => this.setState({metadata: {...this.state.metadata, experiment: experiment, experiment_name: experiment.name}});
    updatePipelineName = (name: string) => this.setState({metadata: {...this.state.metadata, pipeline_name: name}});
    updatePipelineDescription = (desc: string) => this.setState({metadata: {...this.state.metadata, pipeline_description: desc}});
    updateDockerImage = (name: string) => this.setState({metadata: {...this.state.metadata, docker_image: name}});
    updateVolumesSwitch = () => {
        this.setState({
            useNotebookVolumes: !this.state.useNotebookVolumes,
            volumes: this.state.notebookVolumes,
            metadata: {
                ...this.state.metadata,
                volumes: this.state.notebookVolumes,
            },
        })
    };

    // Volume managers
    deleteVolume = (idx: number) => {
        this.setState({
            volumes: this.removeIdxFromArray(idx, this.state.volumes),
            metadata: {...this.state.metadata, volumes: this.removeIdxFromArray(idx, this.state.metadata.volumes)}
        });
    };
    addVolume = () => {
        this.setState({
            volumes: [...this.state.volumes, DefaultEmptyVolume],
            metadata: {...this.state.metadata, volumes: [...this.state.metadata.volumes, DefaultEmptyVolume]}
        });
    };
    updateVolumeType = (type: string, idx: number) => {
        const kaleType: string = (type === "snap") ? "new_pvc" : type;
        const annotations: IAnnotation[] = (type === "snap") ? [{key: "rok/origin", value: ""}]: [];
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...item, type: type, annotations: annotations}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...item, type: kaleType, annotations: annotations}: item})}
        });
    };
    updateVolumeName = (name: string, idx: number) => {
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...item, name: name}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...item, name: name}: item})}
        });
    };
    updateVolumeMountPoint = (mountPoint: string, idx: number) => {
        let cloneVolume: IVolumeMetadata = null;
        if (this.state.volumes[idx].type === "clone") {
            cloneVolume = this.state.notebookVolumes.filter(v => v.mount_point === mountPoint)[0];
        }
        const updateItem = (item: IVolumeMetadata, key: number): IVolumeMetadata => {
            if (key === idx) {
                if (item.type === "clone") {
                    return {...cloneVolume};
                } else {
                    return {...this.state.volumes[idx], mount_point: mountPoint};
                }
            } else {
                return item;
            }
        };
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return updateItem(item, key)}),
            metadata: {
                ...this.state.metadata,
                volumes: this.state.metadata.volumes.map((item, key) => {return updateItem(item, key)})
            }
        });
    };
    updateVolumeSnapshot = (idx: number) => {
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...this.state.volumes[idx], snapshot: !this.state.volumes[idx].snapshot}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...this.state.metadata.volumes[idx], snapshot: !this.state.metadata.volumes[idx].snapshot}: item})}
        });
    };
    updateVolumeSnapshotName = (name: string, idx: number) => {
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...this.state.volumes[idx], snapshot_name: name}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...this.state.metadata.volumes[idx], snapshot_name: name}: item})}
        });
    };
    updateVolumeSize = (size: number, idx: number) => {
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...this.state.volumes[idx], size: size}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...this.state.metadata.volumes[idx], size: size}: item})}
        });
    };
    updateVolumeSizeType = (sizeType: string, idx: number) => {
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return (key === idx) ? {...this.state.volumes[idx], size_type: sizeType}: item}),
            metadata: {...this.state.metadata, volumes: this.state.metadata.volumes.map((item, key) => {return (key === idx) ? {...this.state.metadata.volumes[idx], size_type: sizeType}: item})}
        });
    };
    addAnnotation = (idx: number) => {
        const updateItem = (item: IVolumeMetadata, key: number) => {
            if (key === idx) {
                return {
                    ...item,
                    annotations: [...item.annotations, DefaultEmptyAnnotation]
                };
            } else {
                return item;
            }
        };
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return updateItem(item, key)}),
            metadata: {
                ...this.state.metadata,
                volumes: this.state.metadata.volumes.map((item, key) => {return updateItem(item, key)})
            }
        });
    };
    deleteAnnotation = (volumeIdx: number, annotationIdx: number) => {
        const updateItem = (item: IVolumeMetadata, key: number) => {
            if (key === volumeIdx) {
                return {...item, annotations: this.removeIdxFromArray(annotationIdx, item.annotations)};
            } else {
                return item;
            }
        };
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return updateItem(item, key)}),
            metadata: {
                ...this.state.metadata,
                volumes: this.state.metadata.volumes.map((item, key) => {return updateItem(item, key)})
            }
        });
    };
    updateVolumeAnnotation = (annotation: {key: string, value: string}, volumeIdx: number, annotationIdx: number) => {
        const updateItem = (item: IVolumeMetadata, key: number) => {
            if (key === volumeIdx) {
                return {
                    ...item,
                    annotations: this.updateIdxInArray(annotation, annotationIdx, item.annotations)
                };
            } else {
                return item;
            }
        };
        this.setState({
            volumes: this.state.volumes.map((item, key) => {return updateItem(item, key)}),
            metadata: {
                ...this.state.metadata,
                volumes: this.state.metadata.volumes.map((item, key) => {return updateItem(item, key)})
            }
        });
    };
    getNotebookMountPoints = (): {label: string; value: string}[] => {
        const mountPoints: {label: string, value: string}[] = [];
        this.state.notebookVolumes.map((item) => {
            mountPoints.push({label: item.mount_point, value: item.mount_point});
        });
        return mountPoints;
    };
    activateRunDeployState = (type: string) => this.setState({runDeployment: true, deploymentType: type});
    changeDeployDebugMessage = () => this.setState({deployDebugMessage: !this.state.deployDebugMessage});


    // restore state to default values
    resetState = () => this.setState({...DefaultState, ...DefaultState.metadata});

    componentDidMount = () => {
        this.state.mounted = true;
        // Notebook tracker will signal when a notebook is changed
        this.props.tracker.currentChanged.connect(this.handleNotebookChanged, this);
        // Set notebook widget if one is open
        if (this.props.tracker.currentWidget instanceof  NotebookPanel) {
            this.setState({activeNotebook: this.props.tracker.currentWidget});
            this.setNotebookPanel(this.props.tracker.currentWidget);
        }
    };

    componentWillUnmount = () => {
        this.state.mounted = false;
    }

    componentDidUpdate = (prevProps: Readonly<IProps>, prevState: Readonly<IState>) => {
        // fast comparison of Metadata objects.
        // warning: this method does not work if keys change order.
        if (JSON.stringify(prevState.metadata) !== JSON.stringify(this.state.metadata)
            && this.state.activeNotebook) {
            // Write new metadata to the notebook and save
            NotebookUtils.setMetaData(
                this.state.activeNotebook,
                KALE_NOTEBOOK_METADATA_KEY,
                this.state.metadata,
                true)
        }

        // deployment button has been pressed
        if (prevState.runDeployment !== this.state.runDeployment && this.state.runDeployment) {
            this.runDeploymentCommand()
        }
    };

    /**
    * This handles when a notebook is switched to another notebook.
    * The parameters are automatically passed from the signal when a switch occurs.
    */
    handleNotebookChanged = async (tracker: INotebookTracker, notebook: NotebookPanel) => {
        if (!this.state.mounted) {
            return;
        }
        // Set the current notebook and wait for the session to be ready
        if (notebook) {
            this.setState({activeNotebook: notebook});
            await this.setNotebookPanel(notebook)
        } else {
            this.setState({activeNotebook: null});
            await this.setNotebookPanel(null)
        }
    };

    handleNotebookDisposed = async (notebookPanel: NotebookPanel) => {
        notebookPanel.disposed.disconnect(this.handleNotebookDisposed);
    };

    handleActiveCellChanged = async (notebook: Notebook, activeCell: Cell) => {
        this.setState({activeCell: activeCell, activeCellIndex: notebook.activeCellIndex});
    };

    /**
     * Read new notebook and assign its metadata to the state.
     * @param notebook active NotebookPanel
     */
    setNotebookPanel = async (notebook: NotebookPanel) => {
        // if there at least an open notebook
        if (this.props.tracker.size > 0 && notebook) {
            // wait for the session to be ready before reading metadata
            await notebook.session.ready;
            notebook.disposed.connect(this.handleNotebookDisposed);
            notebook.content.activeCellChanged.connect(this.handleActiveCellChanged);
            const currentCell = {activeCell: notebook.content.activeCell, activeCellIndex: notebook.content.activeCellIndex};
            this.getExperiments();
            // Get information about volumes currently mounted on the notebook server
            this.getMountedVolumes()

            // get notebook metadata
            const notebookMetadata = NotebookUtils.getMetaData(
                notebook,
                KALE_NOTEBOOK_METADATA_KEY
            );
            console.log("Kubeflow metadata:");
            console.log(notebookMetadata);
            // if the key exists in the notebook's metadata
            if (notebookMetadata) {
                let experiment: IExperiment = {id: '', name: ''};
                if (notebookMetadata['experiment']) {
                    experiment = {
                        id: notebookMetadata['experiment']['id'] || '',
                        name: notebookMetadata['experiment']['name'] || '',
                    };
                }
                let stateVolumes = (notebookMetadata['volumes'] || []).map((volume: IVolumeMetadata) => {
                    if (volume.type === 'new_pvc' && volume.annotations.length > 0 && volume.annotations[0].key === 'rok/origin') {
                        return {...volume, type: 'snap'};
                    }
                    return volume;
                });
                if (stateVolumes.length === 0) {
                    stateVolumes = DefaultState.notebookVolumes;
                }

                let metadata: IKaleNotebookMetadata = {
                    experiment: experiment,
                    experiment_name: notebookMetadata['experiment_name'] || '',
                    pipeline_name: notebookMetadata['pipeline_name'] || '',
                    pipeline_description: notebookMetadata['pipeline_description'] || '',
                    docker_image: notebookMetadata['docker_image'] || '',
                    volumes: notebookMetadata['volumes'] || [],
                };
                this.setState({
                    volumes: stateVolumes,
                    metadata: metadata, ...currentCell
                });
            } else {
                this.setState({metadata: DefaultState.metadata, ...currentCell})
            }
        }
    };

    runDeploymentCommand = async () => {
        const nbFileName = this.state.activeNotebook.context.path.split('/').pop();

        let mainCommand = (coreCommand: string) => `
_kale_jp_command_debug = ${this.state.deployDebugMessage ? "True" : "False"}
try:
    ${coreCommand}
    _kale_output_message = ['ok']
except Exception as e:
    if _kale_jp_command_debug:
        _kale_output_message = [traceback.format_exc()]
    else:
        _kale_output_message = [str(e), 'To see full traceback activate the debugging option in Advanced Settings']
        `;
        const initKaleCommand = `
    import traceback
    from kale.core import Kale as _Kale_Class
    from kale.utils import kfp_utils as _kale_kfp_utils
    _kale_instance = _Kale_Class(source_notebook_path='${nbFileName}')
    _kale_pipeline_graph, _kale_pipeline_parameters = _kale_instance.notebook_to_graph()
    _kale_generated_script_path = _kale_instance.generate_kfp_executable(_kale_pipeline_graph, _kale_pipeline_parameters)
    _kale_package_path = _kale_kfp_utils.compile_pipeline(_kale_generated_script_path, _kale_instance.pipeline_metadata['pipeline_name'])
    _kale_pipeline_name = _kale_instance.pipeline_metadata['pipeline_name']
        `;
        const uploadPipelineCommand = (overwrite: string = 'False') => `
    _kale_kfp_utils.upload_pipeline(
        pipeline_package_path=_kale_package_path,
        pipeline_name=_kale_pipeline_name,
        overwrite=${overwrite},
        host=_kale_instance.pipeline_metadata.get('kfp_host', None)
    )
        `;
        const runPipelineCommand = `
    _kale_kfp_utils.run_pipeline(
        run_name=_kale_instance.pipeline_metadata['pipeline_name'] + '_run',
        experiment_name=_kale_instance.pipeline_metadata['experiment_name'],
        pipeline_package_path=_kale_package_path,
        host=_kale_instance.pipeline_metadata.get('kfp_host', None)
    )
        `;

        // CREATE PIPELINE
        const expr = {output: "_kale_output_message", pipeline_name: "_kale_pipeline_name"};
        const output = await NotebookUtils.sendKernelRequest(this.state.activeNotebook, mainCommand(initKaleCommand), {...expr, script_path: "_kale_generated_script_path"}, false);
        const boxTitle = (error: boolean) => error ? "Operation Failed" : "Operation Successful";
        let initCommandResult = eval(output.output.data['text/plain']);
        if (initCommandResult[0] !== 'ok') {
            await NotebookUtils.showMessage(boxTitle(true), initCommandResult);
            // stop deploy button icon spin
            this.setState({runDeployment: false});
        }
        initCommandResult = ["Pipeline saved successfully at " + output.script_path.data['text/plain']];
        if (this.state.deploymentType === 'compile') {
            await NotebookUtils.showMessage(boxTitle(false), initCommandResult);
        }

        // UPLOAD
        if (this.state.deploymentType === 'upload') {
            const output = await NotebookUtils.sendKernelRequest(this.state.activeNotebook, mainCommand(uploadPipelineCommand()), expr, false);
            const uploadCommandResult = eval(output.output.data['text/plain']);
            if (uploadCommandResult[0] !== 'ok') {
                // Upload failed. Probably because pipeline already exists
                // show dialog to ask user if he wants to overwrite the existing pipeline
                const result: boolean = await NotebookUtils.showYesNoDialog(
                    "Pipeline Upload Failed",
                    "Pipeline with name " + output.pipeline_name.data['text/plain'] + " already exists. " +
                    "Would you like to overwrite it?",
                );
                // OVERWRITE EXISTING PIPELINE
                if (result) {
                    // re-send upload command to kernel with `overwrite` flag
                    const output = await NotebookUtils.sendKernelRequest(this.state.activeNotebook, mainCommand(uploadPipelineCommand('True')), expr, false);
                    const upload_error = (eval(output.output.data['text/plain'])[0] !== 'ok');
                    const boxMessage = upload_error ?
                        eval(output.output.data['text/plain']):
                        ["Pipeline with name " + output.pipeline_name.data['text/plain'] + " uploaded successfully."];
                    await NotebookUtils.showMessage(boxTitle(upload_error), boxMessage);
                }
            } else {
                // Upload success
                initCommandResult.push(["Pipeline with name " + output.pipeline_name.data['text/plain'] + " uploaded successfully."]);
                await NotebookUtils.showMessage(boxTitle(false), initCommandResult);
            }
        }

        // RUN
        if (this.state.deploymentType === 'run') {
            const output = await NotebookUtils.sendKernelRequest(this.state.activeNotebook, mainCommand(runPipelineCommand), expr, false);
            const runCommandResult = eval(output.output.data['text/plain']);
            if (runCommandResult[0] !== 'ok') {
                await NotebookUtils.showMessage(boxTitle(true), runCommandResult);
            } else {
                initCommandResult.push(["Pipeline run created successfully"]);
                await NotebookUtils.showMessage(boxTitle(false), initCommandResult);
            }

        }
        // stop deploy button icon spin
        this.setState({runDeployment: false});
    };

    // Execute kale.rpc module functions
    // Example: func_result = await this.executeRpc("rpc_submodule.func", {arg1, arg2})
    //          where func_result is a JSON object
    executeRpc = async (func: string, kwargs: any = {}) => {
        const cmd: string = `
from kale.rpc.run import run
__result = run("${func}", "${JSON.stringify(kwargs)}")
        `;
        console.log("Executing command: " + cmd);
        const expressions = {result: "__result"};
        const output = await NotebookUtils.sendKernelRequest(this.state.activeNotebook, cmd, expressions);

        const argsAsStr = Object.keys(kwargs).map(key => `${key}=${kwargs[key]}`).join(', ');
        let msg = [
            `Function Call: ${func}(${argsAsStr})`,
        ];
        // Log output
        if (output.result.status !== "ok") {
            const title = `Kernel failed during code execution`;
            msg = msg.concat([
                `Status: ${output.result.status}`,
                `Output: ${JSON.stringify(output, null, 3)}`
            ]);
            console.error([title].concat(msg));
            await NotebookUtils.showMessage(title, msg);
            return null;
        }

        console.log(msg.concat([output]));
        const raw_data = output.result.data["text/plain"];
        const json_data = raw_data.substring(1, raw_data.length - 1);

        // Validate response is a JSON
        // If successful, run() method returns json.dumps() of any result
        let parsedResult = undefined;
        try {
            parsedResult = JSON.parse(json_data);
        } catch (error) {
            const title = `Failed to parse response as JSON`;
            msg = msg.concat([
                `Error: ${JSON.stringify(error, null, 3)}`,
                `Response data: ${json_data}`
            ]);
            console.error(msg);
            await NotebookUtils.showMessage(title, msg);
            return null;
        }

        if (parsedResult.status !== 0) {
            const title = `An error has occured`;
            msg = msg.concat([
                `Status: ${parsedResult.status} (${getRpcStatusName(parsedResult.status)})`,
                `Type: ${JSON.stringify(parsedResult.err_cls, null, 3)}`,
                `Message: ${parsedResult.err_message}`
            ]);
            console.error(msg);
            await NotebookUtils.showMessage(title, msg);
            return null;
        } else {
            msg = msg.concat([
                `Result: ${parsedResult}`
            ]);
            console.log(msg);
            return parsedResult.result;
        }
    };

    getExperiments = async () => {
        this.setState({gettingExperiments: true});
        const list_experiments: IExperiment[] = await this.executeRpc("kfp.list_experiments");
        if (list_experiments) {
            this.setState({experiments: list_experiments.concat([NEW_EXPERIMENT])});
        } else {
            this.setState({experiments: [NEW_EXPERIMENT]});
        }

        // Fix experiment metadata
        let selectedExperiments: IExperiment[] = this.state.experiments.filter(
            e => (
                e.id === this.state.metadata.experiment.id
                || e.name === this.state.metadata.experiment.name
                || e.name === this.state.metadata.experiment_name
            )
        );
        if (selectedExperiments.length === 0 || selectedExperiments[0].id === NEW_EXPERIMENT.id) {
            let name = this.state.experiments[0].name;
            if (name === NEW_EXPERIMENT.name) {
                name = (this.state.metadata.experiment.name !== '') ?
                    this.state.metadata.experiment.name
                    : this.state.metadata.experiment_name;
            }
            this.updateExperiment({
                ...this.state.experiments[0],
                name: name,
            });
        } else {
            this.updateExperiment(selectedExperiments[0]);
        }

        this.setState({gettingExperiments: false});
    };

    getMountedVolumes = async () => {
        let notebookVolumes: IVolumeMetadata[] = await this.executeRpc("nb.list_volumes");

        if (notebookVolumes) {
            notebookVolumes = notebookVolumes.map((volume) => {
                const sizeGroup = selectVolumeSizeTypes.filter(s => volume.size >= s.base)[0];
                volume.size = Math.ceil(volume.size / sizeGroup.base);
                volume.size_type = sizeGroup.value;
                volume.annotations = [];
                return volume;
            });
            DefaultState.metadata.volumes = notebookVolumes;
            this.setState({
                notebookVolumes: notebookVolumes,
                selectVolumeTypes: selectVolumeTypes
            });
        } else {
            this.setState({selectVolumeTypes: selectVolumeTypes.slice(0, selectVolumeTypes.length - 1)});
        }
    };

    render() {

        // FIXME: What about human-created Notebooks? Match name and old API as well
        const selectedExperiments: IExperiment[] = this.state.experiments.filter(
            e => (
                e.id === this.state.metadata.experiment.id
                || e.name === this.state.metadata.experiment.name
                || e.name === this.state.metadata.experiment_name
            )
        );
        if (this.state.experiments.length > 0 && selectedExperiments.length === 0) {
            selectedExperiments.push(this.state.experiments[0]);
        }
        let experimentInputSelected = '';
        let experimentInputValue = ''
        if (selectedExperiments.length > 0) {
            experimentInputSelected = selectedExperiments[0].id;
            if (selectedExperiments[0].id === NEW_EXPERIMENT.id) {
                if (this.state.metadata.experiment.name !== '') {
                    experimentInputValue = this.state.metadata.experiment.name;
                } else {
                    this.state.metadata.experiment_name;
                }
            } else {
                experimentInputValue = selectedExperiments[0].name;
            }
        }
        const experiment_name_input = <ExperimentInput
            updateValue={this.updateExperiment}
            options={this.state.experiments}
            selected={experimentInputSelected}
            value={experimentInputValue}
            loading={this.state.gettingExperiments}
        />

        const pipeline_name_input = <MaterialInput
            label={"Pipeline Name"}
            updateValue={this.updatePipelineName}
            value={this.state.metadata.pipeline_name}
            regex={"^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"}
            regexErrorMsg={"Pipeline name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character."}
        />;

        const pipeline_desc_input = <MaterialInput
            label={"Pipeline Description"}
            updateValue={this.updatePipelineDescription}
            value={this.state.metadata.pipeline_description}
        />;

        const volsPanel = <VolumesPanel
            volumes={this.state.volumes}
            addVolume={this.addVolume}
            updateVolumeType={this.updateVolumeType}
            updateVolumeName={this.updateVolumeName}
            updateVolumeMountPoint={this.updateVolumeMountPoint}
            updateVolumeSnapshot={this.updateVolumeSnapshot}
            updateVolumeSnapshotName={this.updateVolumeSnapshotName}
            updateVolumeSize={this.updateVolumeSize}
            updateVolumeSizeType={this.updateVolumeSizeType}
            deleteVolume={this.deleteVolume}
            updateVolumeAnnotation={this.updateVolumeAnnotation}
            addAnnotation={this.addAnnotation}
            deleteAnnotation={this.deleteAnnotation}
            notebookMountPoints={this.getNotebookMountPoints()}
            selectVolumeSizeTypes={selectVolumeSizeTypes}
            selectVolumeTypes={this.state.selectVolumeTypes}
            useNotebookVolumes={this.state.useNotebookVolumes}
            updateVolumesSwitch={this.updateVolumesSwitch}
        />;

        return (
            <div className={"kubeflow-widget"}>
                <div className={"kubeflow-widget-content"}>

                    <div>
                        <p style={{fontSize: "var(--jp-ui-font-size2)" }}
                           className="kale-header">
                            Kale  Deployment  Panel
                        </p>
                    </div>

                    <div className="kale-component">
                        <div>
                            <p className="kale-header">Pipeline Metadata</p>
                        </div>

                        <div className={'input-container'}>
                            {experiment_name_input}
                            {pipeline_name_input}
                            {pipeline_desc_input}
                        </div>
                    </div>


                    {/*  CELLTAGS PANEL  */}
                    <div className="kale-component">
                        <CellTags
                            notebook={this.state.activeNotebook}
                            activeCellIndex={this.state.activeCellIndex}
                            activeCell={this.state.activeCell}
                        />
                        {/*  --------------  */}
                    </div>

                    {volsPanel}

                    <div className="kale-component">
                        <CollapsablePanel
                            title={"Advanced Settings"}
                            dockerImageValue={this.state.metadata.docker_image}
                            dockerChange={this.updateDockerImage}
                            debug={this.state.deployDebugMessage}
                            changeDebug={this.changeDeployDebugMessage}
                        />
                    </div>

                    <div className="kale-component">
                        <SplitDeployButton
                            running={this.state.runDeployment}
                            handleClick={this.activateRunDeployState}
                        />
                    </div>
                </div>

            </div>
        );
    }
}