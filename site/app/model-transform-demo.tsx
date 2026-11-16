"use client";

import { modelHtml, readModelMarkdown } from "@hunch/model";
import { useEffect, useMemo, useRef, useState } from "react";
import { homeExampleMarkdown } from "../lib/home-example";

type DemoView = "markdown" | "model";

export function ModelTransformDemo() {
    const [view, setView] = useState<DemoView>("markdown");
    const [markdown, setMarkdown] = useState(homeExampleMarkdown);
    const [copied, setCopied] = useState(false);
    const result = useMemo(() => readModelMarkdown(markdown), [markdown]);
    const rendered = useMemo(() => result.model === null ? null : modelHtml(result.model), [result.model]);
    const changed = markdown !== homeExampleMarkdown;
    const exampleRef = useRef<HTMLDivElement>(null);

    // The hero's links sit on this panel's bottom edge, but only the Markdown
    // view's edge: the diagram is far taller, and following it moved the links
    // below the fold the moment someone pressed Render. So the hero is told
    // which view is up and how tall the Markdown view was (the textarea is
    // resizable, hence the observer), and holds the links there.
    // Recorded again on the way to the diagram, because the observer reports
    // after layout and a resize just before the switch may not have reached it.
    const recordMarkdownHeight = () => {
        const example = exampleRef.current;
        const hero = example?.closest<HTMLElement>(".hero");
        if (!example || !hero) return;
        hero.style.setProperty("--demo-markdown-height", `${example.offsetHeight}px`);
    };

    const showModel = () => {
        if (view === "markdown") recordMarkdownHeight();
        setView("model");
    };

    useEffect(() => {
        const example = exampleRef.current;
        const hero = example?.closest<HTMLElement>(".hero");
        if (!example || !hero) return;
        hero.dataset.demoView = view;
        if (view !== "markdown") return;
        recordMarkdownHeight();
        const observer = new ResizeObserver(recordMarkdownHeight);
        observer.observe(example);
        return () => observer.disconnect();
    }, [view]);

    const copyMarkdown = async () => {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
    };

    const updateMarkdown = (value: string) => {
        setMarkdown(value);
        setCopied(false);
    };

    const resetMarkdown = () => {
        setMarkdown(homeExampleMarkdown);
        setCopied(false);
    };

    return (
        <div className="modelExample" ref={exampleRef}>
            <p className="eyebrow">Markdown → hunch model</p>
            <div className="transformDemo">
                <div className="demoToolbar">
                    <div className="demoViews" aria-label="Example view">
                        <button
                            type="button"
                            className="demoViewButton"
                            aria-pressed={view === "markdown"}
                            onClick={() => setView("markdown")}
                        >
                            <span>01</span> Markdown
                        </button>
                        <span className="demoArrow" aria-hidden="true">→</span>
                        <button
                            type="button"
                            className="demoViewButton"
                            aria-pressed={view === "model"}
                            onClick={showModel}
                        >
                            <span>02</span> Diagram
                        </button>
                    </div>
                    <span className="demoLive"><i aria-hidden="true" />Live</span>
                </div>

                {view === "markdown" ? (
                    <div className="demoSourcePanel">
                        <label className="demoSourceLabel" htmlFor="home-model-markdown">
                            Edit the source
                            <span>Try changing Alex, a prop, an action, or a thought.</span>
                        </label>
                        <textarea
                            id="home-model-markdown"
                            className="demoMarkdown"
                            value={markdown}
                            onChange={(event) => updateMarkdown(event.target.value)}
                            spellCheck={false}
                            autoCapitalize="off"
                            aria-describedby="home-model-status"
                        />
                        <div className="demoFooter">
                            <p id="home-model-status">
                                {result.model === null
                                    ? "Add a title, :type: model, and at least one scene."
                                    : result.problems.length > 0
                                        ? `${result.problems.length} ${result.problems.length === 1 ? "line stays" : "lines stay"} private.`
                                        : "Every visible line becomes part of the model."}
                            </p>
                            <div className="demoActions">
                                <button type="button" onClick={copyMarkdown}>{copied ? "Copied" : "Copy"}</button>
                                {changed ? <button type="button" onClick={resetMarkdown}>Reset</button> : null}
                                <button className="demoPrimaryAction" type="button" onClick={showModel}>
                                    Render model <span aria-hidden="true">→</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="demoModelPanel">
                        {rendered === null ? (
                            <div className="demoInvalid" role="status">
                                <p className="eyebrow">The Markdown needs a little more</p>
                                <h3>No model to draw yet.</h3>
                                <ul>
                                    {result.problems.map((problem, index) => <li key={`${index}-${problem}`}>{problem}</li>)}
                                </ul>
                            </div>
                        ) : (
                            <div className="hm heroModel" data-theme="dark">
                                <div className="hm-page" dangerouslySetInnerHTML={{ __html: rendered }} />
                            </div>
                        )}
                        <div className="demoFooter demoModelFooter">
                            <p>
                                {rendered === null
                                    ? "The diagram updates when the Markdown has the required structure."
                                    : changed
                                        ? "This diagram was generated from your edited Markdown."
                                        : "This diagram is generated from the exact Markdown in the first step."}
                            </p>
                            <div className="demoActions">
                                {changed ? <button type="button" onClick={resetMarkdown}>Reset</button> : null}
                                <button className="demoPrimaryAction" type="button" onClick={() => setView("markdown")}>
                                    Edit Markdown
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
