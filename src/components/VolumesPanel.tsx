import * as React from "react";
import {MaterialInput, MaterialSelect} from "./Components";
import {IVolumeMetadata} from "./LeftPanelWidget";
import Switch from "react-switch";

interface IProps {
    volumes: IVolumeMetadata[],
    addVolume: Function,
    deleteVolume: Function,
    updateVolumeType: Function,
    updateVolumeName: Function,
    updateVolumeMountPoint: Function,
    updateVolumeSnapshot: Function,
    updateVolumeSnapshotName: Function,
    updateVolumeSize: Function,
    updateVolumeSizeType:Function,
    updateVolumeAnnotation: Function,

}

const selectValues = [
    {label: "New Volume", value: 'new_pvc'},
    {label: "Existing PVC", value: 'pvc'},
    {label: "Existing PV", value: 'pv'}
];

const selectVolumeSizeTypes = [
    {label: "Gi", value: "Gi"},
    {label: "Mi", value: "Mi"},
    {label: "Ki", value: "Ki"}
];

export class VolumesPanel extends React.Component<IProps, any> {

    render() {

        let vols =
                <div className="toolbar">
                    <div className="input-container">
                        No volumes mounts defined
                    </div>
                </div>;

        if (this.props.volumes.length > 0) {
            vols =
                <div> {
                this.props.volumes.map((v, idx) => {
                    const nameLabel = selectValues.filter((d) => {return (d.value === v.type)})[0].label;

                    const sizePicker = (v.type === 'pv' || v.type === 'new_pvc') ?
                            <div className='toolbar'>
                                <MaterialInput
                                    updateValue={this.props.updateVolumeSize}
                                    value={v.size}
                                    label={'Volume size'}
                                    inputIndex={idx}
                                    numeric
                                />
                                <MaterialSelect
                                    updateValue={this.props.updateVolumeSizeType}
                                    values={selectVolumeSizeTypes}
                                    value={v.size_type}
                                    label={"Type"}
                                    index={idx}/>
                            </div>:
                        null;

                    const annotationField = (v.type === 'pv' || v.type === 'new_pvc') ?
                        <MaterialInput
                            label={"Annotation"}
                            inputIndex={idx}
                            updateValue={this.props.updateVolumeAnnotation}
                            value={v.annotation}
                        />: null;

                    return (
                    <div className='input-container' key={idx}>
                        <div className="toolbar">
                            <MaterialSelect
                                updateValue={this.props.updateVolumeType}
                                values={selectValues}
                                value={v.type}
                                label={"Select Volume Type"}
                                index={idx}/>
                            <div>
                                <button type="button"
                                        className="minimal-toolbar-button"
                                        title="Delete Volume"
                                        onClick={_ => this.props.deleteVolume(idx)}
                                >
                                    <span
                                        className="jp-CloseIcon jp-Icon jp-Icon-16"
                                        style={{padding: 0, flex: "0 0 auto", marginRight: 0}}/>
                                </button>
                            </div>
                        </div>

                         <MaterialInput
                            label={nameLabel + " Name"}
                            inputIndex={idx}
                            updateValue={this.props.updateVolumeName}
                            value={v.name}
                            regex={"^([\\.\\-a-z0-9]+)$"}
                            regexErrorMsg={"Resource name must consist of lower case alphanumeric characters, -, and ."}
                        />

                        <MaterialInput
                            label={"Mount Point"}
                            inputIndex={idx}
                            updateValue={this.props.updateVolumeMountPoint}
                            value={v.mount_point}
                        />


                        {sizePicker}

                        {annotationField}

                        <div className="toolbar" style={{padding: "12px 4px 0 4px"}}>
                            <div className={"switch-label"}>Snapshot Volume</div>
                            <Switch
                                checked={v.snapshot}
                                onChange={_ => this.props.updateVolumeSnapshot(idx)}
                                onColor="#599EF0"
                                onHandleColor="#477EF0"
                                handleDiameter={18}
                                uncheckedIcon={false}
                                checkedIcon={false}
                                boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
                                activeBoxShadow="0px 0px 1px 7px rgba(0, 0, 0, 0.2)"
                                height={10}
                                width={20}
                                className="skip-switch"
                                id="skip-switch"
                            />
                        </div>

                        {(v.snapshot)?
                            <MaterialInput
                                label={"Snapshot Name"}
                                // key={idx}
                                inputIndex={idx}
                                updateValue={this.props.updateVolumeSnapshotName}
                                value={v.snapshot_name}
                                regex={"^([\\.\\-a-z0-9]+)$"}
                                regexErrorMsg={"Resource name must consist of lower case alphanumeric characters, -, and ."}/>
                            : null}
                    </div>
                    )
                }

            )}
                </div>
        }

        return (
            <div>
                <div className={"kale-header-switch"}>
                    <div className="kale-header" style={{padding: "0"}}>
                        Volumes
                    </div>
                    <div className={"skip-switch-container"}>
                        <button type="button"
                                className="minimal-toolbar-button"
                                title="Add Volume"
                                onClick={_ => this.props.addVolume()}
                        >
                        <span className="jp-Icon" style={{padding: 0, flex: "0 0 auto", marginRight: 0}}>
                            Add Volume
                        </span>
                        </button>
                    </div>
                </div>

                {vols}

            </div>
        )

    }

}