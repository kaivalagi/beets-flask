import React, {
    Dispatch,
    SetStateAction,
    createContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { Slide, Button, Box, Portal, IconButton } from "@mui/material";
import { ChevronDown, Terminal as TerminalIcon } from "lucide-react";

import "node_modules/@xterm/xterm/css/xterm.css";
import { Terminal as xTerminal } from "@xterm/xterm";
import { FitAddon as xTermFitAddon } from "@xterm/addon-fit";
import styles from "./terminal.module.scss";
import { useSocket } from "@/lib/socket";
import { Socket } from "socket.io-client";

const SlideIn = ({ children }: { children: React.ReactNode }) => {
    const { gui, open, toggle, setOpen } = useTerminalContext();

    // prevent scrolling of main content when terminal is open
    // would be nicer to scroll depending on where the mouser cursor is, but that seems more difficult.
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
    }, [open]);

    // keyboard shortcut to toggle terminal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Backquote" && e.ctrlKey) {
                if (open) {
                    setOpen(false);
                } else {
                    setOpen(true);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, setOpen]);

    return (
        <Portal container={document.getElementById("app")}>
            <div className={styles.slideIn} data-open={open}>
                <Slide direction="up" in={open}>
                    <div>
                        <div className={styles.slideInHeader}>
                            <IconButton
                                onClick={toggle}
                                color="primary"
                                size="small"
                                className={styles.terminalCollapseButton}
                            >
                                <ChevronDown size={14} />
                            </IconButton>
                        </div>
                        <div className={styles.terminalOuterContainer}>{children}</div>
                    </div>
                </Slide>
            </div>
            <Button
                variant="outlined"
                color="primary"
                onClick={toggle}
                className={styles.terminalExpandButton}
                startIcon={<TerminalIcon size={14} />}
            >
                Terminal
            </Button>
        </Portal>
    );
};

export function Terminal() {
    return (
        <SlideIn>
            <XTermBinding />
        </SlideIn>
    );
}

function XTermBinding() {
    const ref = useRef<HTMLDivElement>(null);
    const { gui } = useTerminalContext();

    useEffect(() => {
        if (!ref.current || !gui) return;

        function copyPasteHandler(e: KeyboardEvent) {
            if (!gui) return false;

            if (e.type !== "keydown") return true;

            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === "v") {
                    // ctrl+shift+v: paste whatever is in the clipboard
                    navigator.clipboard.readText().then((toPaste) => {
                        gui.write(toPaste);
                    });
                    return false;
                } else if (key === "c" || key === "x") {
                    // ctrl+shift+x: copy whatever is highlighted to clipboard

                    // 'x' is used as an alternate to 'c' because ctrl+c is taken
                    // by the terminal (SIGINT) and ctrl+shift+c is taken by the browser
                    // (open devtools).
                    // I'm not aware of ctrl+shift+x being used by anything in the terminal
                    // or browser
                    const toCopy = gui.getSelection();
                    navigator.clipboard.writeText(toCopy);
                    gui.focus();
                    return false;
                }
            }
            return true;
        }

        gui.attachCustomKeyEventHandler(copyPasteHandler);

        const fitAddon = new xTermFitAddon();
        gui.loadAddon(fitAddon);
        gui.open(ref.current);
        fitAddon.fit();

        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
        });

        resizeObserver.observe(ref.current);

        return () => {
            gui.dispose();
            if (ref.current) resizeObserver.unobserve(ref.current);
        };
    }, [gui]);

    return <div ref={ref} className={styles.xTermBindingContainer}></div>;
}

export interface TerminalContextI {
    open: boolean;
    toggle: () => void;
    setOpen: Dispatch<SetStateAction<boolean>>;
    inputText: (input: string) => void;
    socket?: Socket;
    gui?: xTerminal;
}

const TerminalContext = createContext<TerminalContextI>({
    open: false,
    toggle: () => {},
    setOpen: () => {},
    inputText: () => {},
});

export function TerminalContextProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState<xTerminal>();

    const { socket, isConnected } = useSocket();

    useEffect(() => {
        // Create gui on mount
        if (!term) {
            const term = new xTerminal({
                cursorBlink: true,
                macOptionIsMeta: true,
                rows: 12,
                cols: 80,
            });
            term.write("Connecting...");
            setTerm(term);
        }
    }, []);

    // Attatch socketio handler
    useEffect(() => {
        if (!term || !isConnected) return;

        term.writeln("\rConnected!   ");

        term!.onData((data) => {
            if (data === "\x01" || data === "\x04") {
                // prevent ctrl+a because it can detach tmux, and ctrl+d because it can close the terminal
                return;
            }
            console.log("input", data);
            socket.emit("ptyInput", { input: data });
        });

        function onOutput(data: { output: Array<string> }) {
            console.log("output", data);
            // term!.clear(); seems to be preferred from the documentation,
            // but it leaves the prompt on the first line in place - which we here do not want
            // ideally we would directly access the buffer.
            term!.reset();
            data.output.forEach((line, index) => {
                if (index < data.output.length - 1) {
                    term!.writeln(line);
                } else {
                    // Workaround: strip all trailing whitespaces except for one
                    // not a perfect fix (one wrong space remains when backspacing)
                    const stripped_line = line.replace(/\s+$/, " ");
                    term!.write(stripped_line);
                }
            });
        }
        socket.on("ptyOutput", onOutput);

        function onCursorUpdate(data: { x: number; y: number } ) {
            console.log("cursor", data);
            // xterm uses 1-based indexing
            term!.write(`\x1b[${data.y + 1};${data.x + 1}H`);
        }
        socket.on("ptyCursorPosition", onCursorUpdate);

        term.onResize(({ cols, rows }) => {
            console.log(`Terminal was resized to ${cols} cols and ${rows} rows.`);
            socket.emit("ptyResize", { cols, rows: rows });
        });

        // request server update, to reflect current output
        socket.emit("ptyResendOutput");

        return () => {
            socket.off("ptyOutput", onOutput);
            socket.off("ptyCursorPosition", onCursorUpdate);
        };
    }, [isConnected, term, socket]);

    // make first responder directly after opening
    useEffect(() => {
        if (open && term) {
            term.focus();
        }
    }, [open, term]);

    function inputText(t: string) {
        socket.emit("ptyInput", { input: t });
    }

    const terminalState: TerminalContextI = {
        open,
        toggle: () => setOpen(!open),
        setOpen,
        inputText,
        socket,
        gui: term,
    };

    return (
        <TerminalContext.Provider value={terminalState}>
            {children}
        </TerminalContext.Provider>
    );
}

export function useTerminalContext() {
    return React.useContext(TerminalContext);
}
