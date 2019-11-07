import * as React from "react";
import { LinearProgress, CircularProgress } from "@material-ui/core";
import CloseIcon from '@material-ui/icons/Close';
import LinkIcon from '@material-ui/icons/Link';
import LaunchIcon from '@material-ui/icons/Launch';

import { DeployProgressState } from './DeploysProgress';


interface DeployProgress extends DeployProgressState {
    onRemove?: () => void;
}

export const DeployProgress: React.FunctionComponent<DeployProgress> = (props) => {
    const getTaskLink = (task: any) => {
        if (!task.result || !task.result.event) {
            return '#';
        }
        return `${window.location.origin}/rok/buckets/${task.bucket}/files/${task.result.event.object}/versions/${task.result.event.version}`
    }

    const getUploadLink = (pipeline: any) => {
        // link: /_/pipeline/#/pipelines/details/<id>
        // id = uploadPipeline.pipeline.id
        if (!pipeline.pipeline || !pipeline.pipeline.id) {
            return '#';
        }
        return `${window.location.origin}/_/pipeline/#/pipelines/details/${pipeline.pipeline.id}`
    }

    const getRunLink = (pipeline: any) => {
        // link: /_/pipeline/#/runs/details/<id>
        // id = runPipeline.id
        if (!pipeline.id) {
            return '#';
        }
        return `${window.location.origin}/_/pipeline/#/runs/details/${pipeline.id}`
    }


    const getRunText = (pipeline: any) => {
        switch (pipeline.status) {
            case null:
            case 'Running':
                return 'View';
            case 'Terminating':
            case 'Failed':
                return pipeline.status as string;
            default:
                return 'Done';
        }
    }

    let snapshotTpl;
    if (props.task) {
        if (props.task.progress === 100) {
            snapshotTpl =
                <React.Fragment>
                    <a href={getTaskLink(props.task)} target="_blank" rel="noopener noreferrer">
                        Done
                        <LaunchIcon style={{ fontSize: "1rem" }} />
                    </a>
                </React.Fragment>
        } else {
            // FIXME: handle error and canceled in DeployProgress
            const progress = props.task.progress || 0;
            snapshotTpl = <LinearProgress variant="determinate" color='primary' value={progress} />

        }
    }

    let uploadTpl;
    if (props.pipeline) {
        uploadTpl =
            <React.Fragment>
                <a href={getUploadLink(props.pipeline)} target="_blank" rel="noopener noreferrer">
                    Done
                    <LaunchIcon style={{ fontSize: "1rem" }} />
                </a>
            </React.Fragment>
    } else if (props.pipeline === false) {
        uploadTpl =
            <React.Fragment>
                Canceled
            </React.Fragment>
    } else {
        uploadTpl = <LinearProgress color='primary' />
    }

    let runTpl;
    if (props.runPipeline) {
        runTpl =
            <React.Fragment>
                <a href={getRunLink(props.runPipeline)} target="_blank" rel="noopener noreferrer">
                    {getRunText(props.runPipeline)}
                    <LaunchIcon style={{ fontSize: "1rem" }} />
                </a>
            </React.Fragment>
    } else {
        runTpl = <LinearProgress color='primary' />
    }

    return (
        <div className='deploy-progress'>
            <div style={{ justifyContent: "flex-end", textAlign: "right", paddingRight: "4px", height: "1rem" }}>
                <CloseIcon style={{ fontSize: "1rem", cursor: "pointer" }} onClick={_ => props.onRemove()} />
            </div>

            <div className='deploy-progress-row'>
                <div className="deploy-progress-label">Taking snapshot... </div>
                <div className="deploy-progress-value">{snapshotTpl}</div>
            </div>

            {props.showUploadProgress ?
                (<div className='deploy-progress-row'>
                    <div className="deploy-progress-label">Uploading pipeline... </div>
                    <div className="deploy-progress-value">{uploadTpl}</div>
                </div>) : null}

            {props.showRunProgress ?
                (<div className='deploy-progress-row'>
                    <div className="deploy-progress-label">Running pipeline... </div>
                    <div className="deploy-progress-value">{runTpl}</div>
                </div>) : null}
        </div>
    );
};