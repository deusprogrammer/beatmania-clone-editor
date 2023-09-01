import { useEffect, useRef, useState } from 'react';
import songChart from './chart';
import './App.css';

let ctx;
let audioSource;

let interval;
let startedAt;
let skipNextScrollEvent = false;

const App = () => {
    const [audioBuffer, setAudioBuffer] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [chart, setChart] = useState([]);

    const editorWindow = useRef();

    useEffect(() => {
        setChart(songChart);
    }, [audioBuffer]);

    const onFileLoad = (event) => {
        setIsLoading(true);
        let fr = new FileReader();
        let file = event.target.files[0];
        
        fr.addEventListener("load", async ({target: {result}}) => {
            ctx = new AudioContext();
            let audioBuffer = await ctx.decodeAudioData(result);
            setAudioBuffer(audioBuffer);
            setIsLoading(false);
        });

        fr.readAsArrayBuffer(file);
    }

    const onPlay = () => {
        const el = document.getElementById('editorWindow');
        const scrollValue = parseInt(el.scrollTop) / (parseInt(el.scrollHeight));

        if (audioSource) {
            audioSource.stop(0);
        }
        audioSource = ctx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(ctx.destination);
        audioSource.start(0, scrollValue * audioBuffer.duration);
    
        if (interval) {
            clearInterval(interval);
        }

        startedAt = ctx.currentTime - (scrollValue * audioBuffer.duration);

        setIsPlaying(true);

        interval = setInterval(() => {
            try {
                const el = document.getElementById('editorWindow');
                setScrollTop(((ctx.currentTime - startedAt)/audioBuffer.duration) * (el.scrollHeight));
            } catch (e) {
                console.error(e);
            }
        }, 1/60);
    }

    const onPause = () => {
        if (audioSource) {
            audioSource.stop(0);
        }

        setIsPlaying(false);

        if (interval) {
            clearInterval(interval);
        }
    }

    const onScroll = () => {
        if (skipNextScrollEvent) {
            skipNextScrollEvent = false;
            return;
        }

        if (interval) {
            clearInterval(interval);
        }
        setIsPlaying(false);
        
        const el = document.getElementById('editorWindow');
        const scrollValue = parseInt(el.scrollTop) / (parseInt(el.scrollHeight));

        if (audioSource) {
            audioSource.stop(0);
        }
        audioSource = ctx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(ctx.destination);
        const offset = scrollValue * audioBuffer.duration;
        const duration = 0.1;
        audioSource.start(0, offset, duration);
        startedAt = ctx.currentTime - offset;

        // onPlay();
    }

    const setScrollTop = (value) => {
        skipNextScrollEvent = true;
        const el = document.getElementById('editorWindow');
        el.scrollTop = value;
    }

    const placeBeat = (event) => {
        let {top, bottom} = editorWindow.current.getBoundingClientRect();
        let x = event.clientX;
        let ms = (event.clientY - (top + editorWindow.current.scrollTop) - (bottom - top) / 2) * -1;
        let column = Math.trunc(x/128);

        console.log(`${column}@${ms}ms`);

        let index = Math.trunc(ms/1000);
        let chartCopy = [...chart];
        chartCopy[index] = [...chart[index]];
        chartCopy[index].push({
            column,
            ms
        });

        setChart(chartCopy);
    }

    return <div style={{backgroundColor: 'black', color: 'white'}}>
        <div>
            <input type='file' onChange={onFileLoad} />
            <br />
            {isLoading ? <div>Loading Audio...</div> : null}
            {audioBuffer ? 
                <>
                    {isPlaying ? <button onClick={onPause}>Pause</button> : <button onClick={onPlay}>Play</button>}
                </>: 
                null}
            {audioBuffer ? <div id="editorWindow" style={{position: 'relative', height: 'calc(100vh - 42px)', width: '100vw', overflowY: 'scroll', overflowX: 'hidden', transform: 'scaleY(-1)'}} ref={editorWindow} onScroll={onScroll} onClick={onPause}>
                <div style={{height: `${audioBuffer.duration * 1000}px`}} onMouseDown={placeBeat}>
                    {chart.map((second, index) => {
                        if (!second) {
                            return null;
                        }
                        return second.map(({column, ms, end}) => {
                            return <div key={`${column}-${ms}`} style={{position: 'absolute', width: '128px', height: end ? `${end - ms}px` : '32px', top: `calc(${ms}px + 50% - 16px)`, left: column * 128 + 'px', backgroundColor: end ? 'blue' : 'red'}} />
                        });
                    })}
                </div>
            </div> : null}
            <div style={{position: 'fixed', borderBottom: '1px solid white', width: '100%', top: 'calc(100vh - 50%)', left: '0px'}} />
        </div>
    </div>
}

export default App;
