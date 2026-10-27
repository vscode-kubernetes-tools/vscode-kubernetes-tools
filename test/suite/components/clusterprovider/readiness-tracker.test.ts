import * as assert from 'assert';
import * as sinon from 'sinon';
import { trackReadiness } from '../../../../src/components/clusterprovider/readinesstracker';

suite('Cluster readiness tracker', () => {
    test('stops after notifying a terminal readiness result', async () => {
        const check = sinon.stub().resolves(['finished', false] as [string, boolean]);
        let notified: () => void;
        const notification = new Promise<void>((resolve) => { notified = resolve; });
        const onNext = sinon.stub().callsFake(async () => {
            notified();
            return true;
        });

        trackReadiness(0, check).subscribe({ onNext });
        await notification;

        sinon.assert.calledOnceWithExactly(check, 0);
        sinon.assert.calledOnceWithExactly(onNext, 'finished');
        await new Promise((resolve) => setTimeout(resolve, 10));
        sinon.assert.calledOnce(check);
        assert.ok(true);
    });
});
