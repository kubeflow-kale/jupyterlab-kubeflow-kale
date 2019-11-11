///<reference path="../node_modules/@types/node/index.d.ts"/>

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin,
    ILabShell,
    ILayoutRestorer
} from "@jupyterlab/application";

import {
    INotebookTracker
} from '@jupyterlab/notebook';

import {
    IDocumentManager
} from '@jupyterlab/docmanager';

import {ReactWidget} from "@jupyterlab/apputils";

import {Token} from "@phosphor/coreutils";
import {Widget} from "@phosphor/widgets";
import * as React from "react";

import '../style/index.css';

import {KubeflowKaleLeftPanel} from './components/LeftPanelWidget'
import NotebookUtils from "./utils/NotebookUtils";


/* tslint:disable */
export const IKubeflowKale = new Token<IKubeflowKale>(
    "kubeflow-kale:IKubeflowKale"
);

export interface IKubeflowKale {
    widget: Widget;
}

const id = "kubeflow-kale:deploymentPanel";
/**
 * Adds a visual Kubeflow Pipelines Deployment tool to the sidebar.
 */
export default {
    activate,
    id,
    requires: [ILabShell, ILayoutRestorer, INotebookTracker, IDocumentManager],
    provides: IKubeflowKale,
    autoStart: true
} as JupyterFrontEndPlugin<void>;


async function activate(
    lab: JupyterFrontEnd,
    labShell: ILabShell,
    restorer: ILayoutRestorer,
    tracker: INotebookTracker,
    docManager: IDocumentManager,
) {

    let widget: ReactWidget;

    async function load_panel() {
        // Check if NOTEBOOK_PATH env variable exists and if so load
        // that Notebook
        let k = await NotebookUtils.createNewKernel();
        const path = await NotebookUtils.executeRpc(k, "nb.resume_notebook_path");

        let reveal_widget = undefined;
        if (path) {
            console.log("Resuming notebook " + path);
            // open the notebook panel
            reveal_widget = await docManager.openOrReveal(path);
        }

        // add widget
        if (!widget.isAttached) {
            await labShell.add(widget, "left");
        }
        // open widget if resuming from a notebook
        if (reveal_widget) {
            // open kale panel
            widget.activate()
        }
    }

    // Creates the left side bar widget once the app has fully started
    lab.started.then(() => {
        widget = ReactWidget.create(
            <KubeflowKaleLeftPanel
                lab={lab}
                tracker={tracker}
                notebook={tracker.currentWidget}
                docManager={docManager}
            />
        );
        widget.id = "kubeflow-kale/kubeflowDeployment";
        widget.title.iconClass = "jp-kubeflow-logo jp-SideBar-tabIcon";
        widget.title.caption = "Kubeflow Pipelines Deployment Panel";

        restorer.add(widget, widget.id);
    });

    // Initialize once the application shell has been restored
    // and all the widgets have been added to the NotebookTracker
    lab.restored.then(() => {
        load_panel();
    });
}
