import { useEffect, useState } from "react";
import { IconNames } from "@blueprintjs/icons";
import { useParams } from "react-router-dom";

import { Pod } from "../../Types.container-app";
import { AppScreenProps, AppScreen } from "../../Types";
import { ScreenHeader } from ".";
import { ScreenLoader } from "../../components/ScreenLoader";
import { CodeEditor } from "../../components/CodeEditor";

import { useStoreActions } from "../../domain/types";

import "./InspectScreen.css";

export const ID = "pod.inspect";

interface ScreenProps extends AppScreenProps {}

export const Screen: AppScreen<ScreenProps> = () => {
  const [pending, setPending] = useState(true);
  const [pod, setPod] = useState<Pod>();
  const { id } = useParams<{ id: string }>();
  const podFetch = useStoreActions((actions) => actions.pod.podFetch);
  useEffect(() => {
    (async () => {
      try {
        setPending(true);
        const pod = await podFetch({
          Id: id
        });
        setPod(pod);
      } catch (error) {
        console.error("Unable to fetch at this moment", error);
      } finally {
        setPending(false);
      }
    })();
  }, [podFetch, id]);

  if (!pod) {
    return <ScreenLoader screen={ID} pending={pending} />;
  }

  return (
    <div className="AppScreen" data-screen={ID}>
      <ScreenHeader pod={pod} currentScreen={ID} />
      <div className="AppScreenContent">
        <CodeEditor value={`${JSON.stringify(pod || {}, null, 2)}`} mode="json" />
      </div>
    </div>
  );
};

Screen.ID = ID;
Screen.Title = "Pod Inspect";
Screen.Route = {
  Path: `/screens/pod/:id/inspect`
};
Screen.Metadata = {
  LeftIcon: IconNames.EYE_OPEN,
  ExcludeFromSidebar: true
};
