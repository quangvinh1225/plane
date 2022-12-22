import React, { useCallback, useEffect, useState } from "react";
// next
import Link from "next/link";
import dynamic from "next/dynamic";
import type { NextPage } from "next";
import { useRouter } from "next/router";
// swr
import { mutate } from "swr";
// react hook form
import { useForm } from "react-hook-form";
// headless ui
import { Disclosure, Menu, Tab, Transition } from "@headlessui/react";
// fetch keys
import { PROJECT_ISSUES_LIST } from "constants/fetch-keys";
// services
import issuesServices from "lib/services/issues.service";
// common
import { debounce } from "constants/common";
// hooks
import useUser from "lib/hooks/useUser";
// hoc
import withAuth from "lib/hoc/withAuthWrapper";
// layouts
import AppLayout from "layouts/app-layout";
// components
import AddAsSubIssue from "components/project/issues/issue-detail/add-as-sub-issue";
import CreateUpdateIssuesModal from "components/project/issues/create-update-issue-modal";
import IssueDetailSidebar from "components/project/issues/issue-detail/issue-detail-sidebar";
import IssueCommentSection from "components/project/issues/issue-detail/comment/IssueCommentSection";
const IssueActivitySection = dynamic(
  () => import("components/project/issues/issue-detail/activity"),
  {
    loading: () => (
      <div className="w-full h-full flex justify-center items-center">
        <Spinner />
      </div>
    ),
    ssr: false,
  }
);
// ui
import { Spinner, TextArea, HeaderButton, Breadcrumbs } from "ui";
// icons
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
// types
import { IIssue, IssueResponse } from "types";

const RichTextEditor = dynamic(() => import("components/lexical/editor"), {
  ssr: false,
});

const defaultValues = {
  name: "",
  description: "",
  state: "",
  assignees_list: [],
  priority: "low",
  blockers_list: [],
  blocked_list: [],
  target_date: new Date().toString(),
  issue_cycle: null,
  labels_list: [],
};

const IssueDetail: NextPage = () => {
  const router = useRouter();

  const { issueId, projectId } = router.query;

  const { activeWorkspace, activeProject, issues, mutateIssues } = useUser();

  const issueDetail = issues?.results?.find((issue) => issue.id === issueId);

  const prevIssue = issues?.results[issues?.results.findIndex((issue) => issue.id === issueId) - 1];
  const nextIssue = issues?.results[issues?.results.findIndex((issue) => issue.id === issueId) + 1];

  const subIssues = (issues && issues.results.filter((i) => i.parent === issueId)) ?? [];
  const siblingIssues =
    issueDetail &&
    issues?.results.filter((i) => i.parent === issueDetail.parent && i.id !== issueId);

  const [isOpen, setIsOpen] = useState(false);
  const [isAddAsSubIssueOpen, setIsAddAsSubIssueOpen] = useState(false);

  const [preloadedData, setPreloadedData] = useState<
    (Partial<IIssue> & { actionType: "createIssue" | "edit" | "delete" }) | undefined
  >(undefined);

  const [issueDescriptionValue, setIssueDescriptionValue] = useState("");

  const handleDescriptionChange: any = (value: any) => {
    console.log(value);
    setIssueDescriptionValue(value);
  };

  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
    control,
    watch,
  } = useForm<IIssue>({
    defaultValues,
  });

  const submitChanges = useCallback(
    (formData: Partial<IIssue>) => {
      if (!activeWorkspace || !activeProject || !issueId) return;

      mutateIssues(
        (prevData) => ({
          ...(prevData as IssueResponse),
          results: (prevData?.results ?? []).map((issue) => {
            if (issue.id === issueId) {
              return { ...issue, ...formData };
            }
            return issue;
          }),
        }),
        false
      );

      const payload = {
        ...formData,
        // description: formData.description ? JSON.parse(formData.description) : null,
      };

      issuesServices
        .patchIssue(activeWorkspace.slug, projectId as string, issueId as string, payload)
        .then((response) => {
          mutateIssues((prevData) => ({
            ...(prevData as IssueResponse),
            results: (prevData?.results ?? []).map((issue) => {
              if (issue.id === issueId) {
                return { ...issue, ...response };
              }
              return issue;
            }),
          }));
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [activeProject, activeWorkspace, issueId, projectId, mutateIssues]
  );

  useEffect(() => {
    if (issueDetail)
      reset({
        ...issueDetail,
        // description: JSON.stringify(issueDetail.description),
        blockers_list:
          issueDetail.blockers_list ??
          issueDetail.blocker_issues?.map((issue) => issue.blocker_issue_detail?.id),
        blocked_list:
          issueDetail.blocked_list ??
          issueDetail.blocked_issues?.map((issue) => issue.blocked_issue_detail?.id),
        assignees_list:
          issueDetail.assignees_list ?? issueDetail.assignee_details?.map((user) => user.id),
        labels_list: issueDetail.labels_list ?? issueDetail.labels,
        labels: issueDetail.labels_list ?? issueDetail.labels,
      });
  }, [issueDetail, reset]);

  const handleSubIssueRemove = (issueId: string) => {
    if (activeWorkspace && activeProject) {
      issuesServices
        .patchIssue(activeWorkspace.slug, activeProject.id, issueId, { parent: null })
        .then((res) => {
          mutate<IssueResponse>(
            PROJECT_ISSUES_LIST(activeWorkspace.slug, activeProject.id),
            (prevData) => ({
              ...(prevData as IssueResponse),
              results: (prevData?.results ?? []).map((p) =>
                p.id === issueId ? { ...p, ...res } : p
              ),
            }),
            false
          );
        })
        .catch((e) => {
          console.log(e);
        });
    }
  };

  return (
    <AppLayout
      noPadding={true}
      bg="secondary"
      breadcrumbs={
        <Breadcrumbs>
          <Breadcrumbs.BreadcrumbItem
            title={`${activeProject?.name ?? "Project"} Issues`}
            link={`/projects/${activeProject?.id}/issues`}
          />
          <Breadcrumbs.BreadcrumbItem
            title={`Issue ${activeProject?.identifier ?? "Project"}-${
              issueDetail?.sequence_id ?? "..."
            } Details`}
          />
        </Breadcrumbs>
      }
      right={
        <div className="flex items-center gap-2">
          <HeaderButton
            Icon={ChevronLeftIcon}
            label="Previous"
            className={!prevIssue ? "cursor-not-allowed opacity-70" : ""}
            onClick={() => {
              if (!prevIssue) return;
              router.push(`/projects/${prevIssue.project}/issues/${prevIssue.id}`);
            }}
          />
          <HeaderButton
            Icon={ChevronRightIcon}
            disabled={!nextIssue}
            label="Next"
            className={!nextIssue ? "cursor-not-allowed opacity-70" : ""}
            onClick={() => {
              if (!nextIssue) return;
              router.push(`/projects/${nextIssue.project}/issues/${nextIssue?.id}`);
            }}
            position="reverse"
          />
        </div>
      }
    >
      {isOpen && (
        <CreateUpdateIssuesModal
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          projectId={projectId as string}
          prePopulateData={{
            ...preloadedData,
          }}
        />
      )}
      {isAddAsSubIssueOpen && (
        <AddAsSubIssue
          isOpen={isAddAsSubIssueOpen}
          setIsOpen={setIsAddAsSubIssueOpen}
          parent={issueDetail}
        />
      )}
      {issueDetail && activeProject ? (
        <div className="h-full flex gap-5">
          <div className="basis-2/3 space-y-5 p-5">
            <div className="mb-5"></div>
            <div className="rounded-lg">
              {issueDetail.parent !== null && issueDetail.parent !== "" ? (
                <div className="bg-gray-100 flex items-center gap-2 p-2 text-xs rounded mb-5 w-min whitespace-nowrap">
                  <Link href={`/projects/${activeProject.id}/issues/${issueDetail.parent}`}>
                    <a className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 block rounded-full"
                        style={{
                          backgroundColor: issueDetail.state_detail.color,
                        }}
                      />
                      <span className="flex-shrink-0 text-gray-600">
                        {activeProject.identifier}-
                        {issues?.results.find((i) => i.id === issueDetail.parent)?.sequence_id}
                      </span>
                      <span className="font-medium truncate">
                        {issues?.results
                          .find((i) => i.id === issueDetail.parent)
                          ?.name.substring(0, 50)}
                      </span>
                    </a>
                  </Link>
                  <Menu as="div" className="relative inline-block">
                    <Menu.Button className="grid relative place-items-center hover:bg-gray-200 rounded p-1 focus:outline-none">
                      <EllipsisHorizontalIcon className="h-4 w-4" />
                    </Menu.Button>

                    <Transition
                      as={React.Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute left-0 mt-1 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="p-1">
                          {siblingIssues && siblingIssues.length > 0 ? (
                            siblingIssues.map((issue) => (
                              <Menu.Item as="div" key={issue.id}>
                                <Link href={`/projects/${activeProject.id}/issues/${issue.id}`}>
                                  <a className="flex items-center gap-2 p-2 text-left text-gray-900 hover:bg-theme hover:text-white rounded-md text-xs whitespace-nowrap">
                                    {activeProject.identifier}-{issue.sequence_id}
                                  </a>
                                </Link>
                              </Menu.Item>
                            ))
                          ) : (
                            <Menu.Item
                              as="div"
                              className="flex items-center gap-2 p-2 text-left text-gray-900 text-xs whitespace-nowrap"
                            >
                              No other sub-issues
                            </Menu.Item>
                          )}
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              ) : null}
              <div>
                <TextArea
                  id="name"
                  placeholder="Enter issue name"
                  name="name"
                  autoComplete="off"
                  validations={{ required: true }}
                  register={register}
                  onChange={debounce(() => {
                    handleSubmit(submitChanges)();
                  }, 5000)}
                  mode="transparent"
                  className="text-xl font-medium"
                />
                <TextArea
                  id="description"
                  name="description"
                  error={errors.description}
                  validations={{
                    required: true,
                  }}
                  onChange={debounce(() => {
                    handleSubmit(submitChanges)();
                  }, 5000)}
                  placeholder="Enter issue description"
                  mode="transparent"
                  register={register}
                />
                {/* <Controller
                  name="description"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <RichTextEditor
                      // value={JSON.stringify(issueDetail.description)}
                      value={value}
                      onChange={(val) => {
                        debounce(() => {
                          console.log("Debounce");
                          // handleSubmit(submitChanges)();
                        }, 5000)();
                        onChange(val);
                      }}
                      id="issueDescriptionEditor"
                    />
                  )}
                /> */}
              </div>
              <div className="mt-2">
                {subIssues && subIssues.length > 0 ? (
                  <Disclosure defaultOpen={true}>
                    {({ open }) => (
                      <>
                        <div className="flex justify-between items-center">
                          <Disclosure.Button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-xs font-medium">
                            <ChevronRightIcon className={`h-3 w-3 ${open ? "rotate-90" : ""}`} />
                            Sub-issues{" "}
                            <span className="text-gray-600 ml-1">{subIssues.length}</span>
                          </Disclosure.Button>
                          {open ? (
                            <div className="flex items-center">
                              <button
                                type="button"
                                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-xs font-medium"
                                onClick={() => {
                                  setIsOpen(true);
                                  setPreloadedData({
                                    parent: issueDetail.id,
                                    actionType: "createIssue",
                                  });
                                }}
                              >
                                <PlusIcon className="h-3 w-3" />
                                Create new
                              </button>

                              <Menu as="div" className="relative inline-block">
                                <Menu.Button className="grid relative place-items-center rounded p-1 hover:bg-gray-100 focus:outline-none">
                                  <EllipsisHorizontalIcon className="h-4 w-4" />
                                </Menu.Button>

                                <Transition
                                  as={React.Fragment}
                                  enter="transition ease-out duration-100"
                                  enterFrom="transform opacity-0 scale-95"
                                  enterTo="transform opacity-100 scale-100"
                                  leave="transition ease-in duration-75"
                                  leaveFrom="transform opacity-100 scale-100"
                                  leaveTo="transform opacity-0 scale-95"
                                >
                                  <Menu.Items className="origin-top-right absolute right-0 mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                    <div className="p-1">
                                      <Menu.Item as="div">
                                        <button
                                          type="button"
                                          className="flex items-center gap-2 p-2 text-left text-gray-900 hover:bg-theme hover:text-white rounded-md text-xs whitespace-nowrap"
                                          onClick={() => setIsAddAsSubIssueOpen(true)}
                                        >
                                          Add an existing issue
                                        </button>
                                      </Menu.Item>
                                    </div>
                                  </Menu.Items>
                                </Transition>
                              </Menu>
                            </div>
                          ) : null}
                        </div>
                        <Transition
                          enter="transition duration-100 ease-out"
                          enterFrom="transform scale-95 opacity-0"
                          enterTo="transform scale-100 opacity-100"
                          leave="transition duration-75 ease-out"
                          leaveFrom="transform scale-100 opacity-100"
                          leaveTo="transform scale-95 opacity-0"
                        >
                          <Disclosure.Panel className="flex flex-col gap-y-1 mt-3">
                            {subIssues.map((subIssue) => (
                              <div
                                key={subIssue.id}
                                className="group flex justify-between items-center gap-2 rounded p-2 hover:bg-gray-100"
                              >
                                <Link href={`/projects/${activeProject.id}/issues/${subIssue.id}`}>
                                  <a className="flex items-center gap-2 rounded text-xs">
                                    <span
                                      className={`h-1.5 w-1.5 block rounded-full`}
                                      style={{
                                        backgroundColor: subIssue.state_detail.color,
                                      }}
                                    />
                                    <span className="flex-shrink-0 text-gray-600">
                                      {activeProject.identifier}-{subIssue.sequence_id}
                                    </span>
                                    <span className="font-medium max-w-sm break-all">
                                      {subIssue.name}
                                    </span>
                                  </a>
                                </Link>
                                <div className="opacity-0 group-hover:opacity-100">
                                  <Menu as="div" className="relative inline-block">
                                    <Menu.Button className="grid relative place-items-center hover:bg-gray-200 p-1 focus:outline-none">
                                      <EllipsisHorizontalIcon className="h-4 w-4" />
                                    </Menu.Button>

                                    <Transition
                                      as={React.Fragment}
                                      enter="transition ease-out duration-100"
                                      enterFrom="transform opacity-0 scale-95"
                                      enterTo="transform opacity-100 scale-100"
                                      leave="transition ease-in duration-75"
                                      leaveFrom="transform opacity-100 scale-100"
                                      leaveTo="transform opacity-0 scale-95"
                                    >
                                      <Menu.Items className="origin-top-right absolute right-0 mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                          <Menu.Item as="div">
                                            <button
                                              className="flex items-center gap-2 p-2 text-left text-gray-900 hover:bg-theme hover:text-white rounded-md text-xs whitespace-nowrap"
                                              onClick={() => handleSubIssueRemove(subIssue.id)}
                                            >
                                              Remove as sub-issue
                                            </button>
                                          </Menu.Item>
                                        </div>
                                      </Menu.Items>
                                    </Transition>
                                  </Menu>
                                </div>
                              </div>
                            ))}
                          </Disclosure.Panel>
                        </Transition>
                      </>
                    )}
                  </Disclosure>
                ) : (
                  <Menu as="div" className="relative inline-block">
                    <Menu.Button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-xs font-medium">
                      <PlusIcon className="h-3 w-3" />
                      Add sub-issue
                    </Menu.Button>

                    <Transition
                      as={React.Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute origin-top-right left-0 mt-1 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                        <div className="py-1">
                          <Menu.Item as="div">
                            <button
                              type="button"
                              className="text-left p-2 text-gray-900 hover:bg-indigo-50 text-xs whitespace-nowrap w-full"
                              onClick={() => {
                                setIsOpen(true);
                                setPreloadedData({
                                  parent: issueDetail.id,
                                  actionType: "createIssue",
                                });
                              }}
                            >
                              Create new
                            </button>
                          </Menu.Item>
                          <Menu.Item as="div">
                            <button
                              type="button"
                              className="p-2 text-left text-gray-900 hover:bg-indigo-50 text-xs whitespace-nowrap"
                              onClick={() => {
                                setIsAddAsSubIssueOpen(true);
                                setPreloadedData({
                                  parent: issueDetail.id,
                                  actionType: "createIssue",
                                });
                              }}
                            >
                              Add an existing issue
                            </button>
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}
              </div>
            </div>
            <div className="bg-secondary rounded-lg space-y-5">
              <Tab.Group>
                <Tab.List className="flex gap-x-3">
                  {["Comments", "Activity"].map((item) => (
                    <Tab
                      key={item}
                      className={({ selected }) =>
                        `px-3 py-1 text-sm rounded-md border-2 border-gray-700 ${
                          selected ? "bg-gray-700 text-white" : ""
                        }`
                      }
                    >
                      {item}
                    </Tab>
                  ))}
                </Tab.List>
                <Tab.Panels>
                  <Tab.Panel>
                    <IssueCommentSection />
                  </Tab.Panel>
                  <Tab.Panel>
                    <IssueActivitySection />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>
          <div className="h-full basis-1/3 space-y-5 p-5 border-l">
            {/* TODO add flex-grow, if needed */}
            <IssueDetailSidebar
              control={control}
              issueDetail={issueDetail}
              submitChanges={submitChanges}
              watch={watch}
            />
          </div>
        </div>
      ) : (
        <div className="h-full w-full grid place-items-center px-4 sm:px-0">
          <Spinner />
        </div>
      )}
    </AppLayout>
  );
};

export default withAuth(IssueDetail);