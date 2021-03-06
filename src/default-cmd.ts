import {red} from "ansi-colors";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {assert} from "./asserts";

const checkFolderAndFile = (cwd: string) => {
    assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);
    assert(fs.existsSync(`${cwd}/.gitlab-ci.yml`), `${cwd} does not contain .gitlab-ci.yml`);
const checkFolderAndFile = (cwd: string, file?: string) => {
    if (!fs.pathExistsSync(`${cwd}`)) {
        throw new ExitError(`${cwd} is not a directory`);
    }

    const gitlabFilePath = file ? `${cwd}/${file}` : `${cwd}/.gitlab-ci.yml`;
    if (!fs.existsSync(gitlabFilePath)) {
        throw new ExitError(`${cwd} does not contain ${file ?? ".gitlab-ci.yml"}`);
    }
};

exports.command = "$0 [job]";
exports.describe = "Runs the entire pipeline or a single [job]";
exports.builder = (y: any) => {
    y.positional("job", {
        describe: "Jobname to execute",
        type: "string",
    });
};

export async function handler(argv: any) {
    assert(argv.cwd && typeof argv.cwd != "object", '--cwd option cannot be an array');
    const cwd = argv.cwd?.replace(/\/$/, "") ?? ".";
    if (argv.completion != null) {
        yargs.showCompletionScript();
    } else if (argv.list != null) {
        checkFolderAndFile(cwd, argv.file);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid, false, argv.file);
        Commander.runList(parser);
    } else if (argv.job) {
        checkFolderAndFile(cwd, argv.file);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid, false, argv.file);
        await Commander.runSingleJob(parser, argv.job, argv.needs);
    } else {
        checkFolderAndFile(cwd, argv.file);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        const parser = await Parser.create(cwd, pipelineIid, false, argv.file);
        await Commander.runPipeline(parser, argv.manual || []);
    }
}

exports.handler = async (argv: any) => {
    try {
        await handler(argv);
    } catch (e) {
        if (e instanceof ExitError) {
            process.stderr.write(`${red(e.message)}\n`);
            process.exit(1);
        }
        throw e;
    }
};
